# QRMade

> A modern, free QR code generator for creating, customizing, and downloading QR codes.

QRMade is a browser-based QR code generation platform designed to provide a fast, reliable, and straightforward way to create QR codes.

The application supports multiple QR code types, standard one-click generation, optional QR customization, multiple download formats, responsive design, and a separate private analytics system.

---

## Overview

QRMade is built around a simple workflow:

**Enter your content → Generate or Customize → Preview → Download**

Users who only need a standard QR code can generate one using the default black-and-white configuration. Users who want more control over the appearance of their QR code can use the customization workflow.

The public-facing application uses a lightweight frontend architecture, while analytics and administrative functionality are maintained separately.

---

## Features

### QR Code Generation

QRMade supports QR code generation for multiple common use cases:

- URL
- Text
- Wi-Fi
- vCard
- Email
- Phone
- SMS
- WhatsApp
- Location
- Social Media
- Event
- YouTube
- Instagram
- App Links

### Standard QR Generation

The standard generation workflow creates a clean black-and-white QR code using the default configuration.

This provides a fast generation experience for users who simply need a functional QR code without configuring additional design options.

### QR Customization

Users can optionally customize their QR codes using the available design controls.

Customization options include:

- QR colors
- Background colors
- QR styles
- Corner styles
- Size and presentation
- Additional visual settings

Customization is available as part of the free QRMade experience.

### Download Formats

Generated QR codes can be downloaded in multiple formats:

- PNG
- SVG
- PDF

These formats provide flexibility for both digital and print use cases.

---

## Application Architecture

QRMade uses a focused two-page generation architecture.

```text
User
 │
 ▼
index.html
 │
 ├── Select QR Type
 ├── Enter Content
 ├── Generate QR
 └── Customize QR
 │
 ▼
generate.html
 │
 ├── QR Preview
 ├── Download
 └── Generate Another
```

### `index.html`

The primary QR generation interface.

Responsibilities include:

- QR type selection
- User input
- Input validation
- Standard QR generation workflow
- QR customization workflow
- Navigation to the result page

### `generate.html`

The dedicated QR result interface.

Responsibilities include:

- Generated QR preview
- Download controls
- PNG export
- SVG export
- PDF export
- Generate Another functionality
- Navigation back to the generator

Separating the generator and result experiences keeps the primary workflow focused and easy to use.

---

## Analytics

QRMade includes a private analytics system for monitoring application usage and QR generation activity.

The analytics system tracks supported application events such as:

- Visitors
- Page views
- QR generations
- QR type usage
- PNG downloads
- SVG downloads
- PDF downloads

The analytics dashboard provides statistics and visualizations for monitoring application activity.

### Analytics Architecture

The analytics backend is maintained separately from the public frontend.

```text
QRMade Frontend
       │
       │ Analytics Requests
       ▼
Google Apps Script Web App
       │
       ▼
Google Sheets
       │
       ▼
Private Analytics Dashboard
```

The backend processes analytics events and stores the resulting statistics in Google Sheets.

Administrative access to the analytics dashboard is protected separately from the public QR-generation interface.

---

## Technology Stack

### Frontend

- HTML5
- CSS3
- JavaScript
- QR code generation libraries
- Responsive Web Design
- Modern browser APIs

### Analytics

- Google Apps Script
- Google Sheets

### Development

- Visual Studio Code
- Git
- GitHub

### Deployment

- Vercel
- Static web hosting

---

## Project Structure

```text
QRMade/
│
├── index.html
├── generate.html
│
├── style.css
├── script.js
│
├── analysis.html
├── analysis.css
├── analysis.js
│
├── robots.txt
├── sitemap.xml
├── .gitignore
└── README.md
```

### Core Files

| File | Description |
|---|---|
| `index.html` | Main QR generator interface |
| `generate.html` | QR result and download interface |
| `style.css` | Main application styling |
| `script.js` | Main QR generation and frontend functionality |
| `analysis.html` | Private analytics dashboard |
| `analysis.css` | Analytics dashboard styling |
| `analysis.js` | Analytics dashboard functionality |
| `robots.txt` | Search engine crawling configuration |
| `sitemap.xml` | Website sitemap |
| `.gitignore` | Prevents selected files from being committed |
| `README.md` | Project documentation |

---

## User Experience

QRMade is designed around a simple and focused QR-generation workflow.

Key UX considerations include:

- Clear QR type selection
- Readable input fields
- Straightforward generation flow
- Optional customization
- Dedicated result page
- Clear download actions
- Responsive layouts
- Mobile-friendly controls
- Consistent visual hierarchy
- Animations and micro-interactions
- Minimal friction for standard QR generation

The application separates the quick-generation experience from customization so users are not required to configure unnecessary options when they only need a standard QR code.

---

## Responsive Design

QRMade is designed to work across different screen sizes and devices.

Supported layouts include:

- Desktop
- Laptop
- Tablet
- Mobile phones

The interface adapts navigation, QR type selection, forms, customization controls, QR previews, and download actions according to the available screen size.

---

## Performance

QRMade uses a lightweight frontend architecture focused on keeping the public application simple and efficient.

The core QR generation experience runs in the browser, reducing the need for server-side processing for normal QR creation.

This approach provides several advantages:

- Lightweight frontend
- Simple deployment
- Reduced infrastructure requirements
- Fast interaction
- Easy maintenance
- Straightforward version control

---

## SEO & Web Configuration

The project includes standard web configuration files such as:

### `robots.txt`

Provides crawling instructions for search engines.

### `sitemap.xml`

Provides a structured sitemap for supported website pages.

The HTML pages also include the relevant metadata used by the application.

---

## Security & Privacy

The public GitHub repository contains the frontend source code required for the public QRMade application.

Sensitive backend implementation and administrative credentials are kept outside the public repository.

The project uses `.gitignore` to prevent selected private files from being tracked by Git.

Sensitive information such as:

- Passwords
- Authentication credentials
- Private API keys
- Service credentials
- Administrative secrets

should never be included in publicly accessible frontend source code.

The analytics backend is maintained separately from the public frontend repository.

---

## Repository

QRMade is maintained using Git for version control and GitHub for source-code hosting.

Repository:

https://github.com/alanbiju422-dev/QRMade

The public repository serves as the project's source-code reference and development history.

---

## Deployment Architecture

The intended production workflow is:

```text
Local Development
       │
       ▼
      Git
       │
       ▼
    GitHub
       │
       ▼
     Vercel
       │
       ▼
QRMade Production Website
```

GitHub acts as the source-code repository and version-control platform, while Vercel can be used to deploy the production frontend.

This workflow provides a straightforward way to maintain the source code and deploy future updates.

---

## Local Development

Clone the repository:

```bash
git clone https://github.com/alanbiju422-dev/QRMade.git
```

Navigate into the project:

```bash
cd QRMade
```

The public frontend does not require a traditional Node.js build process.

For local testing, open `index.html` in a modern web browser or use a local development server.

---

## Browser Compatibility

QRMade is designed for modern browsers supporting current HTML, CSS, and JavaScript standards.

Recommended browsers include:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Safari
- Modern Chromium-based browsers

---

## Development Principles

QRMade follows several core development principles.

### Simplicity

The standard QR-generation workflow should remain quick and accessible.

### Optional Customization

Customization is available for users who need additional design control without complicating the standard generation process.

### Separation of Concerns

QR generation, result presentation, and analytics are separated into focused parts of the application.

### Responsive Design

The application is designed to remain usable across desktop and mobile devices.

### Maintainability

The project uses a simple structure and Git-based version control to make future development easier.

### Security

Sensitive administrative and backend configuration is separated from the publicly accessible frontend.

### Performance

The public-facing application is kept lightweight to support efficient loading and interaction.

---

## Project Status

**Completed — Final Testing and Launch Preparation**

The core QRMade development phase has been completed.

Implemented functionality includes:

- QR code generation
- Multiple QR code types
- Standard QR generation
- QR customization
- Two-page generation architecture
- QR result interface
- PNG downloads
- SVG downloads
- PDF downloads
- Responsive design
- Mobile-friendly interface
- UI refinement
- Animations and micro-interactions
- Private analytics dashboard
- Analytics integration
- Administrative authentication
- SEO-related configuration
- GitHub version control

The current phase focuses on final deployment, production testing, configuration, and launch preparation.

---

## Future Development

Potential future improvements may include:

- Additional QR formats
- Expanded customization options
- Enhanced analytics
- Accessibility improvements
- Performance optimization
- Additional export capabilities
- Additional automated testing
- Progressive Web App capabilities

Future development will prioritize useful improvements while maintaining the application's simplicity, reliability, and performance.

---

## Contributing

QRMade is currently maintained as an independent project.

The repository primarily serves as the project's public source-code reference and development history.

For substantial changes, improvements, or feature proposals, discussion with the project maintainer is recommended before implementation.

---

## License

No open-source license has currently been granted for this repository.

Unless a license is explicitly added, the source code should not be assumed to be freely reusable, redistributed, or modified for commercial purposes.

---

## Author

**Alan Biju**

Computer Science & Engineering student and developer interested in software development, web technologies, artificial intelligence, and technology.

GitHub:

https://github.com/alanbiju422-dev

---

## QRMade

**Create. Customize. Download.**

A lightweight QR code generation platform built with a focus on simplicity, usability, customization, and a polished web experience.