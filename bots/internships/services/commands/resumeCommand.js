const sendResume = require("../../api/sendResume");

module.exports = {
    name: "/resume",

    description: "Upload your resume for internship matching",

    async execute(message, client, backend, args) {
        const name = args.join(" ").trim();

        if (!name) {
            await message.reply(
                "Usage: `@Internship Job Bot /resume John Smith` with a PDF attached."
            );
            return;
        }

        const attachment = message.attachments.first();

        if (!attachment) {
            await message.reply(
                "Please attach your resume as a PDF."
            );
            return;
        }

        try {
            const requestId = await sendResume(
                backend,
                attachment,
                name,
                message.author.id
            );

            await message.reply(
                "Your resume was successfully received by the backend!\n" +
                `Request ID: \`${requestId}\`\n` +
                "Your resume is awaiting processing."
            );

        } catch (error) {
            console.error("[RESUME] Upload failed:", error);

            await message.reply(
                `Resume submission failed: ${error.message}`
            );
        }
    }
};