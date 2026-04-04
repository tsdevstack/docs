# react-bot-detection

`@tsdevstack/react-bot-detection` is a React library for client-side bot detection using behavioral analysis and honeypot fields. Zero dependencies beyond React, SSR-safe, fully typed.

```bash
npm install @tsdevstack/react-bot-detection
```

## Quick start

```tsx
import { BotProtectedForm } from '@tsdevstack/react-bot-detection';

function ContactForm() {
  const handleSubmit = async (formData: FormData, botResult) => {
    await fetch('/api/contact', {
      method: 'POST',
      body: JSON.stringify({
        email: formData.get('email'),
        botScore: botResult.score,
        isBot: botResult.isBot,
      }),
    });
  };

  return (
    <BotProtectedForm onSubmit={handleSubmit}>
      <input name="email" type="email" placeholder="Email" />
      <textarea name="message" placeholder="Message" />
    </BotProtectedForm>
  );
}
```

## Exports

| Export | Type | Description |
|--------|------|-------------|
| `BotProtectedForm` | Component | Drop-in form wrapper with behavioral analysis + honeypot |
| `useBotDetection()` | Hook | Behavioral analysis for custom form implementations |
| `useHoneypot()` | Hook | Honeypot-based detection for custom forms |
| `Honeypot` | Component | Standalone honeypot field |

## Detection methods

### Behavioral analysis (`useBotDetection`)

Tracks mouse movements, typing patterns, focus events, and time on form. Scores each signal:

| Signal | Score | Description |
|--------|-------|-------------|
| No mouse movement | +30 | Bots often skip mouse events |
| Unnatural mouse patterns | +20 | Perfectly straight lines |
| Consistent typing speed | +15 | Humans have variable rhythm |
| Superhuman typing | +20 | < 50ms between keystrokes |
| Fast form completion | +40 | < 2 seconds total |
| Few focus events | +15 | < 2 field interactions |
| WebDriver detected | +25 | `navigator.webdriver === true` |
| Headless browser | +35 | Window size is 0 |

**Threshold:** Score >= 50 is classified as a bot.

### Honeypot (`useHoneypot`)

Hidden fields invisible to humans but visible to bots that parse HTML. When filled, adds +100 to score.

## `BotProtectedForm` props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSubmit` | `(data, result) => Promise<void>` | required | Called on submission |
| `onBotDetected` | `(result) => void` | — | Called when bot detected |
| `submitButtonText` | `string` | `"Submit"` | Button label |
| `loadingButtonText` | `string` | `"Processing"` | Loading state label |
| `ButtonComponent` | `ComponentType` | — | Custom button for design system integration |
| `showDebugPanel` | `boolean` | `false` | Show detection stats (dev only) |

## Best practices

1. **Always validate server-side** — client-side detection can be bypassed. Send the `botScore` to your backend and verify there.
2. **Don't reveal detection** — silently accept bot submissions but don't process them. This prevents bots from learning your detection methods.
3. **Combine with rate limiting** — bot detection is one layer. Also use IP-based rate limiting and email verification.
4. **Use the debug panel** in development: `showDebugPanel={process.env.NODE_ENV === 'development'}`
