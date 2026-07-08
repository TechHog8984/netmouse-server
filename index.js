import { WebSocketServer } from "ws";
import { exec } from "child_process";
import { URL, parse } from "url";

const wss = new WebSocketServer({ port: 22322 });

const BROWSER = process.env.BROWSER;
if (!BROWSER) {
    console.error("missing env variable BROWSER (which should be the name of an executable in path to use with openurl)");
    process.exit(1);
}

var screenwidth = 1920;
var screenheight = 1080;
var failedtograbresolution = true;

var gamescreenwidth = screenwidth;
var gamescreenheight = screenheight;

const deadband = 0.8;
const button_map = {
    1: "1",
    2: "3",
}

var scroll = false;
var lastscrolltime = Date.now();

function map(x, inmin, inmax, outmin, outmax) {
    return outmin + (x - inmin) * (outmax - outmin) / (inmax - inmin)
}

function getVector(input) {
    var list = input.split(',');
    var x = parseFloat(list[0])
    var y = parseFloat(list[1])

    return [x, y]
}

function checkUrl(str) {
    try {
        var url = new URL(str);
        return url.protocol
                ? ["http", "https"].map(x => `${x.toLowerCase()}:`).includes(url.protocol)
                : false
    } catch (err) {
        return false;
    }
};

wss.on("connection", function connection(ws) {
    if (failedtograbresolution)
        console.error("error: failed to get screen resolution from xrandr... using 1920x1080 as fallback");

    ws.on("error", console.error);

    ws.on("message", function message(data) {
        var datastr = data.toString()
        if (datastr.startsWith("move")) {
            var [x, y] = getVector(datastr.substring(4));
            if (x == NaN || y == NaN) {
                ws.send("bad input");
                return;
            }

            if (scroll) {
                var time = Date.now();
                var elapsed = (time - lastscrolltime);

                if (elapsed > 50) {
                    lastscrolltime = time;

                    if (y > 0)
                        exec("xdotool click 5");
                    else if (y < 0)
                        exec("xdotool click 4");
                }
            } else {
                x = map(x, 0, gamescreenwidth, 0, screenwidth) / (20 * screenwidth / screenheight);
                y = map(y, 0, gamescreenheight, 0, screenheight) / 20;

                if (Math.abs(x) < deadband)
                    x = 0
                if (Math.abs(y) < deadband)
                    y = 0

                console.log("adjusted move: " + x + ", " + y)

                exec(`xdotool mousemove_relative -- ${x} ${y}`);
            }

            ws.send("k");
            return;
        }
        if (datastr.startsWith("click")) {
            var button = parseInt(datastr.substring(5));
            if (button == NaN) {
                ws.send("bad input");
                return;
            }

            console.log("click: " + button);

            if (button == 0) {
                exec("xdotool mouseup 1");
                exec("xdotool mouseup 3");
            } else if (button == 3)
                scroll = false;
            else if (button == 4)
                scroll = true;
            else {
                var buttonstr = button_map[button]
                if (buttonstr == null) {
                    ws.send("bad input");
                    return;
                }

                exec(`xdotool mousedown ${buttonstr}`);
            }

            ws.send("k");
            return;
        }
        if (datastr.startsWith("screensize")) {
            var [x, y] = getVector(datastr.substring(10));
            console.log("screensize from game " + x + ", " + y);
            gamescreenwidth = x;
            gamescreenheight = y;

            ws.send("k");
            return;
        }
        if (datastr.startsWith("openurl")) {
            var url = datastr.substring(7);
            if (!checkUrl(url)) {
                ws.send("bad input");
                return;
            }

            exec(`${BROWSER} ${url}`);
            ws.send("k");
            return;
        }

        ws.send("bad packet... " + datastr);
    });
});

console.log("created server");

exec("/usr/bin/env xrandr 2> /dev/null | grep \\* | cut -d ' ' -f4", (error, stdout, stderr) => {
    var split = stdout.split('\n');
    if (split.length < 1)
        return;
    var resolution = split[0].split('x');
    if (resolution.length < 1)
        return;

    screenwidth = parseInt(resolution[0]);
    screenheight = parseInt(resolution[1]);
    failedtograbresolution = screenwidth == NaN || screenheight == NaN;
});
