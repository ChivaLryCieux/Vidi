# Presentation Design Guide

This document records the visual style used by the LaTeX Beamer presentation, so later slides can stay consistent.

## Overall Direction

- Style: Swiss graphic design with a restrained calligraphy/game identity.
- Mood: quiet, ordered, exhibition-like, and focused on the work itself.
- Core tension: modern grid typography containing traditional Chinese calligraphy.
- Avoid decorative effects that dilute the clean layout.

## Color System

- Background: `#fcf9f4`
  - Warm paper-like base.
  - Use as the full slide background.
- Card: `#ffffff`
  - Used for text blocks and image frames.
  - Keep cards flat. Do not add shadows or gradients.
- Text: `#000000`
  - Primary body and title color.
  - Keep contrast strong and direct.
- Accent: `#80372b`
  - Used sparingly for vertical bars, labels, section markers, and key emphasis.
  - Treat it as a seal-mark or cinnabar accent, not a dominant theme color.
- Muted text: `#5f5a56`
  - Used for subtitles and secondary descriptions.

## Typography

- Chinese font: 待定
```

- Latin font: use a neutral sans-serif.
  - Prefer a Helvetica-like face when available.
  - In the current local TeX environment, direct file loading of Latin Modern Sans
    is more reliable than system font names:

```tex
\setmainfont[
  Path=/usr/local/texlive/2026/texmf-dist/fonts/opentype/public/lm/,
  BoldFont=lmsans10-bold.otf,
  ItalicFont=lmsans10-oblique.otf
]{lmsans10-regular.otf}
\setsansfont[
  Path=/usr/local/texlive/2026/texmf-dist/fonts/opentype/public/lm/,
  BoldFont=lmsans10-bold.otf,
  ItalicFont=lmsans10-oblique.otf
]{lmsans10-regular.otf}
```

- Titles should be large but not theatrical.
- Body text should be compact, direct, and easy to scan.
- Avoid ornate font mixing. The game font should carry the identity.

## Layout Rules

- Use 16:9 Beamer slides:

```tex
\documentclass[aspectratio=169,11pt]{beamer}
```

- Use a visible Swiss-grid structure:
  - two-column layouts;
  - strong left/right alignment;
  - repeated card widths;
  - consistent vertical spacing.
- Add a narrow vertical accent bar on the left edge of most slides.
- Keep navigation symbols hidden.
- Use flat white cards only for bounded content blocks.
- Do not nest cards inside cards.
- Do not use gradients, drop shadows, decorative blobs, or ornamental frames.
- Let screenshots occupy meaningful space. They are the primary visual evidence.

## Slide Header Pattern

Each content slide should have:

- a large black title;
- a small muted subtitle;
- a left accent bar in `#80372b`;
- a small gap before the main grid.

Example macro:

```tex
\newcommand{\slidehead}[2]{%
  \begin{tikzpicture}[remember picture,overlay]
    \fill[Accent] (current page.north west) rectangle ([xshift=0.18cm]current page.south west);
  \end{tikzpicture}
  \vspace{-0.2cm}
  {\fontsize{25}{29}\selectfont #1}\par
  \vspace{0.12cm}
  {\color{Muted}\fontsize{9}{12}\selectfont #2}\par
  \vspace{0.35cm}
}
```

## Cards

- Cards are pure white with no border radius in LaTeX.
- Use them for:
  - short concept blocks;
  - key-value descriptions;
  - screenshots;
  - author/course metadata.
- Card padding should be modest. The style should feel precise, not padded like a
  web landing page.

Example:

```tex
\newcommand{\card}[1]{%
  \begin{beamercolorbox}[wd=\linewidth,sep=0.25cm]{card}
    #1
  \end{beamercolorbox}
}
```

## Labels And Accent Text

- Use accent labels instead of bullet-heavy lists.
- Keep accent text in `#80372b`.

Example:

```tex
\newcommand{\accenttag}[1]{%
  {\color{Accent}\fontsize{10}{12}\selectfont #1}
}
```

## Image Usage
- Screenshots should be framed in white cards.
- Avoid heavy cropping. Let the viewer inspect actual gameplay/interface details.
- Prefer one dominant image per slide over many small thumbnails.
- Use images as evidence for the claims on the slide, not as decoration.

Example:

```tex
\newcommand{\imgcard}[2]{%
  \begin{beamercolorbox}[wd=\linewidth,sep=0.08cm]{card}
    \includegraphics[width=\linewidth,height=#1,keepaspectratio]{#2}
  \end{beamercolorbox}
}
```

## Required Metadata

## Compilation

Compile with XeLaTeX:

```bash
xelatex -interaction=nonstopmode slides.tex
```

Run twice if outline metadata or cross-reference warnings appear.

Expected harmless warnings:

- small `Overfull \hbox` or `Overfull \vbox` warnings from screenshot/card layout;
- Hyperref PDF string warning caused by spacing commands in author metadata.

Warnings that should be fixed:

- missing image files;
- missing `assets/fonts/ke.ttf`;
- `fontspec` errors;
- undefined control sequences;
- LaTeX errors that still produce a PDF in nonstop mode.

## Git Hygiene

Keep generated LaTeX temporary files ignored:

```gitignore
*.aux
*.log
*.nav
*.out
*.snm
*.toc
```

It is acceptable to keep both the source `slides.tex` and final `slides.pdf` in
the project when the PDF is a submission artifact.
