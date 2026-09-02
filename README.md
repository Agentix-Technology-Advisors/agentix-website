# agentix-website

Static multi-page website for Agentix Technology Advisors.

## Pages

- `/` - home page
- `/services/` - services overview
- `/about/` - firm overview
- `/contact/` - contact page
- `/privacy-policy/` - privacy policy
- `/client-portal.html` - password-gated client portal for ZVA voice samples

## Assets

- `assets/css/styles.css` - shared site styling
- `assets/css/client-portal.css` - client portal styling
- `assets/js/main.js` - mobile navigation and reveal interactions
- `assets/js/client-portal.js` - portal auth and voice-library behavior
- `assets/client-portal-voices.json` - voice sample manifest used by the portal
- `assets/images/` - image assets
- `robots.txt` - crawler rules
- `sitemap.xml` - page sitemap

## Local preview

Serve the folder with any static file server, for example:

`python3 -m http.server 4173`

## Client Portal Password

The portal password is checked by SHA-256 hash in `assets/js/client-portal.js`.

To rotate password:

1. Generate a hash:
	 `printf '%s' 'your-new-password' | shasum -a 256`
2. Replace `PORTAL_CONFIG.passwordHash` with the generated value.
3. Reload `/client-portal.html`.

## Static Voice Sample Workflow

The portal expects static MP3 files and a manifest file. Voice generation is done offline in `agentix-agentblueprint` and then copied into this repo.

1. In `agentix-agentblueprint`, mint/bootstrap an authorized Zoom web session token.
2. Run `tools/retrieve-zva-tts-mp3.py` to generate one sample per selected voice with the approved prompt:
	 `Hi there! My name is Ariel and I'm here to help you with your questions.`
3. Place generated MP3 files in this repo under:
	 `assets/audio/client-portal/`
4. Update `assets/client-portal-voices.json` with one object per sample:

```json
{
	"generatedAt": "2026-09-02T00:00:00Z",
	"samplePrompt": "Hi there! My name is Ariel and I'm here to help you with your questions.",
	"voices": [
		{
			"voiceId": "voice-id",
			"voiceName": "Voice Name",
			"ttsProvider": "Azure",
			"language": "en-US",
			"accent": "US",
			"gender": "Female",
			"samplePrompt": "Hi there! My name is Ariel and I'm here to help you with your questions.",
			"file": "/assets/audio/client-portal/voice-name.mp3"
		}
	]
}
```

5. Reload `/client-portal.html` and verify search, play, and download controls.