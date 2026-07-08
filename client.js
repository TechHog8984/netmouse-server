import { WebSocket } from "ws";

const websocketurl = process.argv[2];
if (!websocketurl) {
    console.error("provide a websocketurl");
    process.exit(1);
}
const command = process.argv[3];
if (!command) {
    console.error("provide a command");
    process.exit(1);
}

const ws = new WebSocket(websocketurl);

ws.on("error", console.error);

ws.on("open", function open() {
    ws.send(command);
});

ws.on("message", function message(data) {
    console.log("received: %s", data);
    ws.close();
})
