-- Translate Dutch context variable descriptions to English.
-- These were entered in Dutch during initial setup; the admin UI is English-only.

UPDATE context_variable_metadata
SET description = 'The path of the current page.'
WHERE key = 'pathname';

UPDATE context_variable_metadata
SET description = 'Page type, such as homepage or detail page.'
WHERE key = 'pageType';

UPDATE context_variable_metadata
SET description = 'Page template identifier active for the current render.'
WHERE key = 'templateKey';

UPDATE context_variable_metadata
SET description = 'Whether an experiment is currently active.'
WHERE key = 'experimentActive';

UPDATE context_variable_metadata
SET description = 'Active tenant package.'
WHERE key = 'package';

UPDATE context_variable_metadata
SET description = 'Whether the visitor has previously submitted a form.'
WHERE key = 'hasSubmittedForm';

UPDATE context_variable_metadata
SET description = 'Whether a hero variant has already been shown in this session.'
WHERE key = 'hasSeenHeroVariant';

UPDATE context_variable_metadata
SET description = 'New or returning visit.'
WHERE key = 'visitType';

UPDATE context_variable_metadata
SET description = 'Origin of the visit (channel or referrer).'
WHERE key = 'source';
