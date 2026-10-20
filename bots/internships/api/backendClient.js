const net = require("node:net");
const { EventEmitter } = require("node:events");


class BackendClient extends EventEmitter {
    constructor(host, port, enabled = true) {
        super();
        this.host = host;
        this.port = port;

        this.socket = null;
        this.connected = false;
        this.buffer = "";

        this.reconnectDelay = 10000;
        this.reconnectTimer = null;

        this.stopped = !enabled;

        this.pendingRequests = new Map();
        this.requestTimeout = 15000;
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
            if (this.stopped || this.socket !== socket) {
                socket.destroy();
                return;
            }

            this.connected = true;

            console.log("[TCP] Connected to backend");

            this.emit("connected");

            this.send({
                event: "PING",
                timestamp: new Date().toISOString()
            });
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
            if (this.socket !== socket) {
                return;
            }

            this.connected = false;
            this.socket = null;
            this.buffer = "";

            console.log("[TCP] Disconnected from backend");

            for (const [requestId, pending] of this.pendingRequests) {
                clearTimeout(pending.timeout);
                pending.reject(
                    new Error("Backend disconnected before confirmation")
                );
            }

            this.pendingRequests.clear();

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

    sendWithConfirmation(message) {
        return new Promise((resolve, reject) => {
            if (!this.connected || !this.socket) {
                reject(new Error("Backend is disconnected"));
                return;
            }

            const requestId = message.request_id;
            if (!requestId) {
                reject(new Error("Missing request_id"));
                return;
            }

            if (this.pendingRequests.has(requestId)) {
                reject(new Error("Duplicate request_id"));
                return;
            }

            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(
                    new Error("Backend confirmation timed out")
                );
            }, this.requestTimeout);

            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout
            });

            const sent = this.send(message);
            if (!sent) {
                clearTimeout(timeout);
                this.pendingRequests.delete(requestId);
                reject(new Error("Failed to send message"));
            }
        });
    }

    handleMessage(message) {
        switch (message.event) {
            case "UPLOAD_ACCEPTED":
            case "UPLOAD_REJECTED": {

                const requestId = message.request_id;
                const pending = this.pendingRequests.get(requestId);

                if (!pending) {
                    console.warn(
                        `[TCP] No pending request for ${requestId}`
                    );
                    return;
                }

                clearTimeout(pending.timeout);
                this.pendingRequests.delete(requestId);

                if (message.event === "UPLOAD_ACCEPTED") {
                    console.log(
                        `[TCP] Upload confirmed: ${requestId}`
                    );
                    pending.resolve(message);
                } else {
                    console.error(
                        `[TCP] Upload rejected: ${requestId}`
                    );
                    pending.reject(
                        new Error(
                            message.message || "Upload rejected"
                        )
                    );
                }
                break;
            }

            case "PONG":
                console.log("[TCP] Backend responded to PING");
                break;

            default:
                console.log("[TCP] Received:", message);
        }
    }

    disconnect() {
        if (this.stopped) {
            console.log("[TCP] Backend connection already disabled");
            return;
        }

        this.stopped = true;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.socket) {
            this.socket.destroy();
        }

        console.log("[TCP] Backend connection disabled");
    }

    enable() {
        if (!this.stopped) {
            console.log("[TCP] Backend connection already enabled");
            return;
        }

        this.stopped = false;

        console.log("[TCP] Backend connection enabled");

        if (this.socket) {
            // Wait for the previous socket to finish closing.
            // Its close handler will schedule reconnection.
            return;
        }

        this.connect();
    }

    getStatus() {
        return {
            enabled: !this.stopped,
            connected: this.connected,
            reconnecting: this.reconnectTimer !== null
        };
    }
}

module.exports = BackendClient;