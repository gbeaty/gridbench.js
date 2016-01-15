(function() {

var RaceTracker = window.RaceTracker = window.RaceTracker || {};

// Helper functions defined here
RaceTracker.Helper = {
    fnIsFlashEnabled: function () {
        // Internet Explorer supports the mimeTypes collection, but it is always empty
        if (navigator.mimeTypes && navigator.mimeTypes.length > 0) {
            // Firefox, Google Chrome, Safari, Opera
            var mime = navigator.mimeTypes['application/x-shockwave-flash'];
            if (mime && mime.enabledPlugin) {
                return true;
            }
        } else {
            if (typeof (ActiveXObject) != "undefined") {
            // Internet Explorer
                try {
                    var flash = new ActiveXObject("ShockwaveFlash.ShockwaveFlash.1");
                    return true;
                }
                catch (e) {
                }
            }
        }

        return false;
    }

};



// RaceTracker.DataTable = function (id, aoColumnDefs, should_resize, filter, bTableTools) {
RaceTracker.DataTable = function (config) {

    // fall back incase "new" is not used
    if (!(this instanceof RaceTracker.DataTable)) {
        return new RaceTracker.DataTable(config);
    }

    this.selector = "#" + config.ID;
    this.aoColumnDefs = config.ColumnDefs;
    this.autoScroll =  config.autoScroll || false;
    this.shouldResize = config.shouldResize || false;
    this.filter = config.Filter;
    this.callback = config.callback ? this.rowCallback : null
    this.bTableTools = config.TableTools || false;

    // var selector = "#" + id;
    if (!this.selector) {
        throw "selector is a required argument";
    }

    // this.aoColumnDefs = aoColumnDefs;
    // this.selector = selector;
    var self = this; // closure
    var table = this.table = $(this.selector).dataTable({
        bPaginate: false,
        bFilter: this.filter,
        bAutoWidth: true,
        sScrollX: "100%",
        // sScrollY: "300px",
        oLanguage: { sSearch: "" },
        fnRowCallback: this.callback,
        // iDisplayLength: 20, // number of rows to display on single page 
        // iScrollLoadGap: 20, // amount of data left to go before dt will load next page of data automatically
        // bScrollInfinite: true,
        bScrollCollapse: true,
        aoColumnDefs: this.aoColumnDefs,
        fnInitComplete: function() {
            // initializing tabletools 
            if (self.bTableTools) {
                self.tabletools(this, this.selector, self.bTableTools);
            }

            if (self.shouldResize) {
                // set table size on initialization.
                // using this fn, with its timeout, to wait to resize onload for firefox
                self.sizer();
                // "rate-limiting" for updating size on window resize.
                $(window).resize(function() { self.sizer(); });
            } else if (height) {
                self.update_size(height, this, selector);
            }
            // if autoScroll is sent over as true, run it
            if (self.autoScroll === true) {
                self.auto_scroll(75); // method in prototype
            }

            // remove label text, set placeholder attr instead
            $('.dataTables_filter input[type=text]').attr("placeholder", "search");


        }

    });


    // instance level methods of RaceTracker.DataTables
    // this refers to each instance of RaceTracker.DataTables obj
    _.extend(this, {

        // empty object for non-meta-data columns
        // used to store hidden column data in
        oHiddenColumns: {},

        hold_data: function(position) {
            console.log(position);
            if (position === 0) { // if the position is 0, return we are at the top
                return;
            }

            // deferring this until call stack has cleared
            _.defer(function() {
                 $('div.dataTables_scrollBody').scrollTop(position);
            });


        },

        receive: function(msg) {
            var obj = JSON.parse(msg.data);
            if(obj.clear)
                table.fnClear(false);

            if(obj.upsert) {
                for(var i=0, ul = obj.upsert.length; i<ul; i++) {
                    table.fnUpsertRow(obj.upsert[i]);
                }
                self.showHiddenRow(); // calling this again here since data may be upserted
            }
            if(obj.deleted)
                for(var ii=0, dl = obj.deleted.length; ii<dl; ii++) {
                    table.fnDeleteId(obj.deleted[ii]);
                }

            this.hold_data($('div.dataTables_scrollBody').scrollTop()); // passing over scroll position 

            self.sizer();
            table.fnDraw();

        },

        showHiddenRow: function() {
            // binding click event to the table
            // if the hiddencolumns obj isn't filled with anything, just return
            if (_.size(this.oHiddenColumns) === 0) {
                return;
            }
            var self = this;
            this.table.$("tr").on('click', function(e){
                e.preventDefault();
                var clicked_row = $(e.srcElement).parents('tr')[0]; // the row clicked on
                // if the row is already open, close it
                if (self.table.fnIsOpen(clicked_row)) {
                    self.table.fnClose( clicked_row );
                    $(e.srcElement).parents('tr').removeClass('clicked_row'); // removing special class from clicked row

                } else { // else open it
                    self.table.fnOpen( clicked_row, self.formatHiddenDetails(clicked_row, self.oHiddenColumns), 'details' ); // open table, passing in the clicked row
                    $(e.srcElement).parents('tr').addClass('clicked_row'); // adding special class to the clicked row 
                    $(".details").parents('tr').addClass("details_row_open"); // adding a special class for the row that is opened

                }

            });
        }

    });



    // Functions called by database id.
    // Create an index from dbId -> rowIndex
    // Don't add rows by any other method, or the index breaks.
    // This might be faster than using getElementById()?
    var asId = {};
    var aiIndex = {};


    // using underscores extend to copy methods over to table
    // these represent methods on the datatable
    _.extend(table, {

        fnClear: function(bRedraw) {
            this.fnClearTable(bRedraw);
        },

        fnUpsertRow: function (asRow) {
            var sId = JSON.parse(asRow[0]).id;
            var iIndex = aiIndex[sId];
            if (iIndex == null) {
                iIndex = this.fnAddData(asRow, false)[0];
                asId[iIndex] = sId;
                aiIndex[sId] = iIndex;
            }
            else this.fnUpdate(asRow, iIndex, undefined, false, false);
        },

        fnDeleteId: function (sId) {
            var iIndex = aiIndex[sId];
            if (iIndex != null) {
                this.fnDeleteRow(iIndex);
                aiIndex[sId] = null;
                asId[iIndex] = null;
            }
        }

    });

    for(var i=0, al = this.aoColumnDefs.length; i<al; i++) {
        var columnDef = this.aoColumnDefs[i];
        if(columnDef && columnDef.bVisible === false) {
            for(var ii=0, atl = columnDef.aTargets.length; ii<atl; ii++) {
                var iCol = columnDef.aTargets[ii];
                if(iCol > 0)
                    this.oHiddenColumns[iCol] = true;

            }
            // calling the hidden row method 
            self.showHiddenRow();
        }
    }



};



RaceTracker.DataTable.prototype =  {

    sort: function(col_idx, ordering) {
        this.table.fnSort([[col_idx, ordering]]);
    },

    rowCallback: function( nRow, aData, iDisplayIndex, iDisplayIndexFull ) {
        var oRowMetaData = JSON.parse(aData[0]);
        var linked;
        var rowLinker = function(cell, content) {
            if (oRowMetaData.rowLink) {
                cell.html('<a href="' + oRowMetaData.rowLink + '">' + content + '</a>');
            }
        };

        for(var i = 1, l = aData.length; i < l; i++) {
            cell = $('td:eq(' + (i-1) + ')', nRow);
            content = aData[i];
            if(!content)
                content = "";
            linked = false;


            if(content.substring(0,7) == "<button")
                linked = true;

            if(!linked)
                rowLinker(cell, content);
        }

    },

    sizer: function() {
      var self = this;
      setTimeout(function() {
        self.update_size();}, 250);
    },

    formatHiddenDetails: function(clicked_row, hidden_columns) {
        var column_header = this.table.fnSettings().aoColumns; // header data for column names
        var aData = this.table.fnGetData(clicked_row); // getting data on clicked row
        var hidden_cols = _.keys(hidden_columns); // keys represent the actual hidden column
        var sOut = '<table cellpadding="5" cellspacing="0" border="0" style="margin-left:10%;">'; // setting up hidden row to be put in



        if (!hidden_cols) {
            return;
        }

        // if no hidden columns, no need to be here
        if (hidden_cols.length < 1) {
            return;
        }


        sOut += '<tr class="details_row_header">'; // "header row"

        // insert the titles of the rows
        _.each(hidden_cols, function(hidden_col) {

            sOut += '<td>' + '<span>' +  column_header[hidden_col].sTitle + '</span>' +  '</td>';

        });

        sOut += '</tr><tr>'; // end row for header && start row for data

        // insert the content of the rows
        _.each(hidden_cols, function(hidden_col) {

            sOut += '<td>' + '<span>' +  aData[hidden_col]  + '</span>' +  '</td>';

        });

        sOut += '</tr></table>'; // end row && table

        return sOut;


    },

    update_size: function(height, table, selector) { // optional height arg - force value
        var new_height;

        if (!height) {
            var used_space = 54; // approx height of table header
            var nav = $('.navbar-fixed-top');
            if (nav && nav.css('position') == 'fixed') {
                used_space += nav.height();
            }
            new_height = Math.max(134, $(window).height() - used_space);
        } else {
            // console.log("height: " + height);
            new_height = height;
        }

        // console.log("update_size to " + new_height + " on " + selector + '_wrapper .dataTables_scrollBody');
        $(this.selector + '_wrapper .dataTables_scrollBody').css('max-height', new_height);
        this.table
            .css('width', $(this.selector).parent().width())
            .fnAdjustColumnSizing(false);
    },

        // method for scrolling the table
    auto_scroll: function(interval) {
        var selector = this.selector + "_wrapper", // the current selector
            div = $(selector).find('.dataTables_scrollBody'); // scrollable div within the selector


       var wait_func = function() { setTimeout(function() {
            div.scrollTop(2); // scrolling past top to avoid getting stuck
            scroll_process(); // running the scroll again
           }, 500); // sets the timeout at the top here
       };


       // this function handles the scrolling/looping from top to bottom
       var scroll_process = function() {
        var current_scroll = setInterval(function(){
            var pos = div.scrollTop();
            // if we have reached the bottom, scroll to top
            if (div[0].scrollHeight - div.scrollTop() <= div.outerHeight()) {
                div.animate({scrollTop: 0}, 1000); // scroll to the top in a nice animation
            }

            // if we have scrolled to the top (given above), clear this interval and wait
            if (div.scrollTop() === 0) {
                clearInterval(current_scroll);
                wait_func();

            }

            else {
                div.scrollTop(pos + 2); // else scroll to the current position + 3px
            }

        }, interval);
       };

       // run the scroll process
       scroll_process();


    },

    tabletools: function(table, selector, bTableTools) {
        // Begin TableTools initialization:
        if(bTableTools && RaceTracker.Helper.fnIsFlashEnabled()) {
            var oTableTools = new TableTools(table, {
                "aButtons": [
                    {
                        "sExtends":    "collection",
                        "sButtonText": "Export",
                        "aButtons": [
                            {
                                "sExtends": "copy",
                                "sButtonText": "Copy",
                                "mColumns": "sortable"
                            }, {
                                "sExtends": "csv",
                                "sButtonText": "CSV",
                                "mColumns": "sortable"
                            }, {
                                "sExtends": "xls",
                                "sButtonText": "Excel CSV",
                                "mColumns": "sortable"
                            }, {
                                "sExtends": "pdf",
                                "sButtonText": "PDF",
                                "mColumns": "sortable"
                            }/*, { Doesn't seem to work all that well.
                                "sExtends": "print",
                                "sButtonText": "Print",
                                "mColumns": "sortable"
                            }*/
                        ]
                    }
                ],
                "sSwfPath": "/assets/swf/copy_csv_xls_pdf.swf"
            });

            $(this.selector + '_filter').after( oTableTools.dom.container );
        }
        // End TableTools initialization.

    }

};

})();