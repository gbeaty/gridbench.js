function displayRemaining(el, endTime, nLaps) {

    if(el.timer != null)
        clearInterval(el.timer.interval)

    if(endTime != null)
        el.timer = timeRem(el,endTime)
    else if(nLaps != null) {
        el.timer = null
        el.innerHTML = "<span id='time'>" + nLaps + " laps</span><br>remaining"
    }
    else el.innerHTML = ""

    return el
}

function timeRem(el, end) {

    var timer = new Object()

    timer.el = el
    timer.end = end

    timer.interval = setInterval(function() {
        time = (timer.end - Date.now()) / 1000

        if(time <= 0) {
            timer.el.innerHTML = ("<span id='time'>00:00</span><br>remaining")
            return
        } else {
            var hours = Math.floor(time / 3600)
            var minutes = Math.floor((time - hours * 3600) / 60 );
            var seconds = Math.floor(time % 60)
            if (hours > 0)
                hours = hours + ":"
                else hours = ""
            if (minutes < 10) minutes = "0" + minutes
            if (seconds < 10) seconds = "0" + seconds
            sTime = hours + minutes + ':' + seconds
        }
        timer.el.innerHTML = ("<span id='time'>" + sTime + "</span><br>remaining")
    }, 1000);

    return timer
}