# Changelog

All notable changes to this project are documented in this file.

## [0.8.0] - 2026-02-18

### Added
- Profile system with save/select/update/delete for roster, coaches and locations.
- Profile quick-switch dropdown in top bar.
- SVG-based language flags (`DE` / `GB`) for consistent display across devices.
- Event planner day quick-picks (weekday + date) for faster date entry.
- Participant list collapse/expand per event card.
- Mobile/tablet UX improvements:
  - larger touch targets,
  - responsive top-bar behavior,
  - mobile-friendly profile quick menu.
- GitHub CI workflow (`lint` + `build`).
- Migration guide for GitHub setup.

### Changed
- Event card click behavior:
  - card click now selects/highlights,
  - event editor opens only via gear/edit control.
- Broader i18n coverage and dictionary updates.
- Ongoing refactor/extraction into hooks/state/utils modules.

### Fixed
- Color picker interaction reliability in settings.
- Localized weekday display in event cards.
- Multiple runtime/lint stability issues addressed during refactor.
