const net = require("node:net");

class BackendClient {
    constructor(host, port) {
        this.host = host;
        this.port = port;

        this.socket = null;
        this.connected = false;
        this.buffer = "";

        this.reconnectDelay = 5000;
        this.reconnectTimer = null;
        this.stopped = false;
    }

    connect() {
        if (this.connected || this.socket || this.stopped) return;

        console.log(`[TCP] Connecting to ${this.host}:${this.port}`);

        const socket = net.createConnection({
            host: this.host,
            port: this.port
        });

        this.socket = socket;
        socket.setEncoding("utf8");

        socket.on("connect", () => {
            this.connected = true;
            console.log("[TCP] Connected to backend");

            // Temporary connection test
            this.send({
                event: "PING",
                timestamp: new Date().toISOString()
            });
            // delete till here
        });

        socket.on("data", (data) => {
            this.buffer += data;

            let index;

            // TCP is a stream, so messages need framing.
            // Each JSON message ends with a newline.
            while ((index = this.buffer.indexOf("\n")) !== -1) {
                const message = this.buffer.slice(0, index);
                this.buffer = this.buffer.slice(index + 1);

                if (!message.trim()) continue;

                try {
                    const parsed = JSON.parse(message);
                    this.handleMessage(parsed);
                } catch (error) {
                    console.error("[TCP] Invalid JSON:", error.message);
                }
            }
        });

        socket.on("error", (error) => {
            console.error("[TCP] Connection error:", error.message);
        });

        socket.on("close", () => {
            this.connected = false;
            this.socket = null;
            this.buffer = "";

            console.log("[TCP] Disconnected from backend");

            if (!this.stopped) {
                this.scheduleReconnect();
            }
        });
    }

    scheduleReconnect() {
        if (this.reconnectTimer || this.stopped) return;

        console.log(
            `[TCP] Reconnecting in ${this.reconnectDelay / 1000}s`
        );

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectDelay);
    }

    send(message) {
        if (!this.connected || !this.socket) {
            console.error("[TCP] Cannot send: backend disconnected");
            return false;
        }

        try {
            this.socket.write(JSON.stringify(message) + "\n");
            return true;
        } catch (error) {
            console.error("[TCP] Send failed:", error.message);
            return false;
        }
    }

    handleMessage(message) {
        switch (message.event) {
            case "PONG":
                console.log("[TCP] Backend responded to PING:", message);
                break;

            default:
                console.log("[TCP] Received:", message);
        }
    }

    disconnect() {
        this.stopped = true;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.socket) {
            this.socket.destroy();
        }
    }
}

module.exports = BackendClient;