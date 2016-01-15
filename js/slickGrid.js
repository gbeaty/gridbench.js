/*
  x Sorting
  x Filtering
    Export to CSV/PDF
  x Auto-scrolling
  x Row-links
    Hidden rows
*/

var MySlick = function() {
	var sg = {};
	var pixelPerChar = 8
	sg.create = function(sel, grid, dataView) {

		// constants dict for selectors has name and type
		var SELECTOR_CONSTS = {
			TABLE_MESSAGE: "table_message_container",
			EXTRA_ADDED_VIEW: "extra_added_view"

		};

		var hasReceived = false

		var metaFormatter = function(formatter) {
			return function(row, cell, value, columnDef, dataContext) {
				return formatter(value, dataContext);
			};
		};

		var cols = []
		for(var i=0; i<grid.cols.length; i++) {
			var col = grid.cols[i]
			cols[i] = $.extend({}, col)
			cols[i].field = col.id

			//cols[i].width = col.charWidth * pixelPerChar

			if(col.formatter)
				cols[i].formatter = metaFormatter(col.formatter)
		}

		if(grid.getItemMetaData !== undefined) {
			dataView.getItemMetaData = grid.getItemMetaData
		}

		// specifying master grid level options
		// these apply to all grids
		var myOptions = {
			forceFitColumns: true,
			rowHeight: 45,
			enableColumnReorder: false,
			cellFlashingCssClass: 'flashing_cell'
		};

		// making sure we don't overwrite any specific options
		if (grid.options) {
			_.extend(myOptions, grid.options);
		}

		var newGrid = new Slick.Grid(sel, dataView, cols, myOptions);
		var rwParams = grid.options.rwParams ? grid.options.rwParams : {}
		var searchString = "";

		// binding the grid resize when window is resized
		$(window).resize(function() {
			newGrid.resizeCanvas();
		});

		// attaching an event listener for resizing the canvas
		$(sel).on('resize_canvas', function() {
			_.defer(function() {
				newGrid.resizeCanvas();
			});
		});

		$("#txtSearch").keyup(function (e) {
			Slick.GlobalEditorLock.cancelCurrentEdit();

			if (e.which == 27) {
				this.value = "";
			}

			searchString = this.value.toLowerCase();
			dataView.setFilterArgs({searchString: searchString});
			dataView.setFilter(filter);
			dataView.refresh();
		});

		function filter(item, args) {
			if(args.searchString === "") {
				return true;
			}

			for(var prop in item) {
				if (item[prop].toString().toLowerCase().indexOf(args.searchString) > -1)
					return true;
			}

			return false;
		}
		grid.filterPos = function(start, end) {
			dataView.setFilterArgs({start: parseInt(start), end: parseInt(end)})
			dataView.setFilter(function(item, args) {
				var pos = item.pos
				if(pos === undefined) return true;
				if(args.start !== undefined && pos < args.start) return false;
				if(typeof args.end !== undefined && pos > args.end) return false;
				return true;
			})
			dataView.refresh()
		}

		newGrid.onHeaderRowCellRendered.subscribe(function(e, args) {
			$(args.node).empty();
			$("<input type='text'>")
				.data("columnId", args.column.id)
				.val(columnFilters[args.column.id])
				.appendTo(args.node);
		});

		dataView.onRowCountChanged.subscribe(function (e, args) {
			tableEvents.clear_table_message(sel)
			newGrid.updateRowCount();
			newGrid.render();
		});
		dataView.onRowsChanged.subscribe(function (e, args) {			
			newGrid.invalidateRows(args.rows);
			newGrid.render();
			var i = args.rows.length
			while(--i >= 0) {
				var index = args.rows[i]
				var row = dataView.getItem(index)
				if(!dataView.clear) {
					if(grid.flashingRow) {
						grid.flashingRow(row.oldRow, row, newGrid, index)
					} else {
						tableEvents.highlight_cell(index);
					}					
				}
				delete row.oldRow
			}
		});
		newGrid.onSort.subscribe(function (e, args) {
			sortCol = args.sortCol.field;
			sort(args.sortAsc);
		});

		newGrid.onClick.subscribe(function (e, args) {
			// grabbing row info of the clicked row
			var row_info = dataView.getItem(args.row);
			// only running if hidden data is specified
			if(grid.hidden_data) {
				var clicked_parent_row = $(e.target).parent('.slick-row')[0];
				tableEvents.create_detail_view(row_info, clicked_parent_row);
			}

			if (grid.routeTo) {
				var type = grid.routeTo.type; // the type specified in the grid
				var loc_id = row_info[grid.routeTo.uniqueProperty]; // the unique property to find the location
				tableEvents.routeToView(type, loc_id);

			}

		});

		// specific events when table is clicked on
		var tableEvents = {};

		_.extend(tableEvents, {
			// this method routes to a view based on the type sent over e.g. "event"
			// and the specific type
			routeToView: function(type, loc_id) {
				window.location = type + "/" + loc_id;
			},

			// this method creates a container for results table
			create_detail_view: function(row_data, clicked_row) {
				var parent_container = $(clicked_row).parents('.sg-container');
				var added_div = $('#extra_added_view');
				var the_field;
				if(added_div.length) {
					added_div.remove();
				}
				var div = "<div id="+ SELECTOR_CONSTS.EXTRA_ADDED_VIEW +"><i id='go_back_to_table' class='icon-remove icon-large'></i>";
				div += "<h2><span class='number'>" + row_data.num + " </span><span class='racer'>" + row_data.team + "</span></h2>";
				div += "<table class='laps'>";
				_.each(row_data, function(row, key) {
					// grabbing the specific field that is equal to the key
					the_field = grid.rowInfo[key];
					// if the field exists and there is data
					if (the_field && row) {
						div += "<tr class=" + key + ">";
						div += "<td>" + the_field.name + "</td>";
						// if there is a formatter, use it
						if (the_field.formatter) {
							div += "<td>" +  the_field.formatter(row) + "</td>";
						} else { // else just display the name
							div += "<td>" + row + "</td>";
						}
						div += "</tr>";
					}

				});

				div += "</table>";
				div += "</div>";
				$(clicked_row).parents(".main-column").append(div);
				parent_container.css('margin-bottom', "30%");
				// setting the box header to be the team name
				// appending the slide inner
				// removing the added view and showing the table
				$("#go_back_to_table").on('click', function() {
					$("#" + SELECTOR_CONSTS.EXTRA_ADDED_VIEW).remove();
					parent_container.css('margin-bottom', "0");

				});
			},
			// method for highlighting changing cell
			highlight_cell: function(row) {
				// we need to defer this to wait until after the row has changed
				_.defer(function() {
					newGrid.flashCell(row, 0, 600);
				});
			},
			// this method shows an empty message in the grid container
			show_empty_message: function(sel, gridMessage) {
				var msg_content = gridMessage || "No" + grid.gridName + "at this time.";
				$(sel).parents('.slide-inner').append("<div class=" + SELECTOR_CONSTS.TABLE_MESSAGE +"><p class='alert'>" + msg_content + " </p></div>");
			},
			// this method clears the table message
			clear_table_message: function(sel) {
				$(sel).parents('.slide-inner').children('.' + SELECTOR_CONSTS.TABLE_MESSAGE).remove();
			}
		});

		// adding specific classes to each row
		dataView.getItemMetadata = function(row, args) {
			return {
				'cssClasses': 'row_id_' + row
			};
		};

		var sort = function(asc) {
			dataView.sort(sortBuilder(asc), true);
		}
		var sortBuilder = function(asc) {
			return function(a,b) {
				var x = a[sortCol],
						y = b[sortCol];
				x = isNaN(x) ? x : parseFloat(x)
				y = isNaN(y) ? y : parseFloat(y)
				if(x === y) return 0;
				if(x === undefined) return 1;
				if(y === undefined) return -1;
				return (x>y ? 1 : -1) * (asc ? 1 : -1)
			}
		}

		grid.autoScroll = function(pixelDelay, topDelay, bottomDelay) {
			if(!pixelDelay)
				return;

			var scrollDiv = sel.find('.slick-viewport');

			var doTop = function() {
				setTimeout(function() {
					doMiddle();
				}, topDelay);
			};
			var doMiddle = function() {
				var pos = scrollDiv.scrollTop();
				if(scrollDiv[0].scrollHeight - scrollDiv.scrollTop() <= scrollDiv.outerHeight(false)) {
					doBottom();

				} else {
						scrollDiv.scrollTop(pos + 1);
						setTimeout(doMiddle, pixelDelay);
					}
			};
			var doBottom = function() {
				setTimeout( function() {
					scrollDiv.animate({scrollTop: 0}, 1000, doTop);
				}, bottomDelay);
			};

			doTop();
		};

		var sortCol = grid.sortCol ? grid.sortCol.id : undefined

		dataView.beginUpdate();
		var sortAsc = myOptions.sortAsc === false ? false : true
		if(sortCol !== undefined) {
			sort(sortAsc)
			newGrid.setSortColumn(sortCol,sortAsc)
		}
		dataView.endUpdate();

		if(grid.callback) {
			grid.callback(grid, newGrid);
		}

		// if the grid has an empty message show it
		if (grid.gridEmptyMessage) {
			tableEvents.show_empty_message(sel, grid.gridEmptyMessage);
		}

		return grid;
	};

	return sg;
}();