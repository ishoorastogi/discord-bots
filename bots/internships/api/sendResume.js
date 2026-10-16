const crypto = require("node:crypto");

const MAX_PDF_SIZE = 5 * 1024 * 1024;
const DOWNLOAD_TIMEOUT = 15000;

async function sendResume(backend, attachment, name, discordId) {

    if (!backend?.connected || !backend?.socket) {
        throw new Error("Backend is not connected");
    }

    if (typeof name !== "string" || !name.trim()) {
        throw new Error("Invalid name");
    }

    const userId = String(discordId);

    if (!/^\d+$/.test(userId)) {
        throw new Error("Invalid Discord ID");
    }

    if (!attachment?.name?.toLowerCase().endsWith(".pdf")) {
        throw new Error("Only PDF attachments are supported");
    }

    if (attachment.size > MAX_PDF_SIZE) {
        throw new Error("PDF exceeds 5 MB");
    }

    const response = await fetch(attachment.url, {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)
    });

    if (!response.ok) {
        throw new Error(`PDF download failed: ${response.status}`);
    }

    const chunks = [];
    let totalBytes = 0;

    for await (const chunk of response.body) {

        totalBytes += chunk.length;

        if (totalBytes > MAX_PDF_SIZE) {
            throw new Error("Downloaded PDF exceeds 5 MB");
        }

        chunks.push(chunk);
    }

    const pdfBuffer = Buffer.concat(chunks);

    if (pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
        throw new Error("Invalid PDF file");
    }

    const requestId = crypto.randomUUID();

    const payload = {
        event: "RESUME_UPLOAD",
        request_id: requestId,
        data: {
            discord_id: userId,
            name: name.trim(),
            filename: attachment.name,
            pdf_base64: pdfBuffer.toString("base64")
        }
    };

    await backend.sendWithConfirmation(payload);
    return requestId;
}

module.exports = sendResume;