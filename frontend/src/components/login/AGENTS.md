# Login rules

- The login form lives in `FormEntrar.tsx` (the route only navigates) so it is testable with a mocked `api`; password inputs with show/hide use `CampoSenha` (same `<input>`, only `type` toggles, button is `type="button"`) so value, autofill and focus survive the toggle.
