# Quick Ask for ChatGPT — Privacy Policy

Effective date: November 8, 2026.

Publisher and maintainer: Zesen Long (GitHub: OrionHachiii).

Privacy and support contact: zesenl@uci.edu.

Quick Ask for ChatGPT is an independent browser extension that provides explanations, translations, examples, and answers about text selected in ChatGPT responses. It is not affiliated with OpenAI.

## Data handled

When you select text and start a question, the extension processes the selected text, your question, and up to 1,200 characters from the beginning of the selected ChatGPT response to guide the reply language. It reads the answer generated in its separate helper tab and displays it in the original page's floating panel. These data may contain personal communications, personal information, or other sensitive information depending on the content you select and type.

The extension also uses temporary task identifiers, source and helper tab identifiers, task status, and deadlines to deliver answers to the correct panel. It does not collect a browsing-history database, analytics, advertising identifiers, account credentials, authentication cookies, or login tokens. It does not monitor other websites. Page-level selection and input event listeners support the visible interface; these events are not saved as activity logs or transmitted as analytics.

## Purpose and transmission

The selected text, question, language-reference excerpt, and a short instruction are submitted to ChatGPT using the message editor of a separate chatgpt.com tab in your signed-in browser session. This transmission is necessary to provide the explanation or answer you request. No API key is requested. The extension does not use a developer-operated processing server.

Your use of ChatGPT remains subject to OpenAI's terms, privacy policy, account settings, and usage limits. ChatGPT may retain the independent conversations in your account. The extension does not control OpenAI's retention, training settings, personalization, or handling of requests. Review those settings before sending sensitive content.

## Local storage and retention

Pending prompts and job state are stored temporarily in chrome.storage.session to allow the extension's service worker to resume. Prompt text is removed after completion or a handled error, including timeout. Task records are removed when you close the panel, replace its question, or close the source tab. A browser restart or extension reload clears session storage. Closing or refreshing a page may leave an independent ChatGPT conversation in your account.

Selections and displayed answers are held in page memory while that page remains open. Closing the floating panel hides it; it does not necessarily erase all content from that page's memory immediately. Reloading or closing the page clears that in-page state. The extension does not keep a persistent local chat database or synchronize it through Chrome Sync.

## Data use restrictions

The extension uses the data described above to provide its selection-based reading assistance and manage the associated request. It does not sell user data, use it for advertising, determine creditworthiness, or provide it for lending decisions. The extension does not send data to developer-operated analytics services. This describes the extension's own behavior; OpenAI's independent processing is governed by its policies.

## Your choices

Only start a question when you want the selected text and the bounded excerpt sent to ChatGPT. Avoid selecting or typing information you do not want shared with that service. Use the close button or Esc to cancel and close the helper tab. Closing a tab does not delete the conversation from ChatGPT. Manage or delete those conversations and relevant account settings directly in ChatGPT. You may disable or uninstall the extension in Chrome to stop its operation.

## Contact and updates

For privacy questions or support, email zesenl@uci.edu or open an issue in this project’s GitHub repository. Please do not include private chat content, credentials, or other sensitive data in public issues.

The publisher should update this policy when the extension's data handling changes and display the new effective date.
