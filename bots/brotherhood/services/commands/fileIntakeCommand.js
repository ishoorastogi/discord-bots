const {
    parseFile,
    isSupportedFile,
} = require("../../../../shared/utils/fileParser");
const { memberFileSchema } = require("../memberFileSchema");

const MAX_FILE_BYTES = 10 * 1024 * 1024;

async function readAttachment(attachment) {
    if (attachment.size > MAX_FILE_BYTES) {
        throw new Error("File exceeds the 10 MB intake limit.");
    }
    const response = await fetch(attachment.url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
        throw new Error(`Could not download the attachment (HTTP ${response.status}).`);
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
        size += chunk.length;
        if (size > MAX_FILE_BYTES) {
            await response.body.cancel().catch(() => {});
            throw new Error("File exceeds the 10 MB intake limit.");
        }
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

async function execute(message) {
    const attachments = [...message.attachments.values()];
    if (!attachments.length) {
        return {
            type: "fileIntake",
            files: [],
            message: "Attach a .csv or .xlsx file to `@Brotherhood Bot /fileintake`.",
        };
    }

    const files = [];
    for (const attachment of attachments) {
        let result;
        if (!isSupportedFile(attachment.name)) {
            result = {
                ok: false,
                errors: [{ message: "Unsupported file type. Upload a .csv or .xlsx file." }],
            };
        } else {
            try {
                const buffer = await readAttachment(attachment);
                result = await parseFile(buffer, attachment.name, { schema: memberFileSchema });
            } catch (error) {
                result = {
                    ok: false,
                    errors: [{ message: error.name === "TimeoutError" ?
                        "Attachment download timed out. Please try again." : error.message }],
                };
            }
        }
        files.push({ fileName: attachment.name, ...result });
    }

    // The router owns Discord replies; the command only downloads and parses.
    return { type: "fileIntake", files };
}

module.exports = {
    name: "/fileintake",
    execute,
};
