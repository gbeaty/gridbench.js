(function() {

	var RaceTracker = window.RaceTracker = window.RaceTracker || {};

	RaceTracker.eventConsumer = function(url) {
		consumer = new Object
		if (!!window.EventSource) {
			consumer.eventSource = new EventSource(url)
		}
		else console.log('We need to add Comet support for this browser!')

		consumer.scalarListen = function(eventId, elementId) {
			var el = document.getElementById(elementId)
			consumer.eventSource.addEventListener(eventId, function(msg) {
				el.innerHtml = msg.data
			})
		}

		consumer.dataTableListen = function(eventId, elementId) {
			var el = document.getElementById(elementId)
			consumer.eventSource.addEventListener(eventId, function(msg) {
				el.table.receive(msg)
			})
		}

		return consumer
	}
})()