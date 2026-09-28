# Contact Form Helper

This unpacked Chrome extension fills name, email, and message fields on the current page after an explicit user action. It never clicks Submit and does not interact with CAPTCHA.

## Install

1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Choose this `contact-form-helper` directory.
5. Pin **Contact Form Helper** to the Chrome toolbar.

Enter the sender name once. On a merchant contact page, click the extension and select **Fill current page**, or press **Command+Shift+Y**.

Enable **Auto-fill matching forms when pages load** to populate matching contact fields automatically. It still never clicks Submit or interacts with CAPTCHA.

Enable **After I submit, open the next queue record** to mark the current queue item submitted and navigate the same tab to the next pending eligible record after your manual Submit action.

Press **Command+Shift+.** at any time to move to the next eligible pending queue record without changing the current record's status. Chrome shortcuts can be customized at `chrome://extensions/shortcuts`.

For a hosted operator, open **Queue connection** in the popup and enter the Vercel URL and the same `EXTENSION_API_TOKEN` configured in Vercel. Localhost remains the default for local use.

Always review the populated fields before manually submitting.
