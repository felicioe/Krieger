<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules

- No backend of our own (no Lovable Cloud/Supabase, no server functions): the app is a static SPA that talks to an existing PHP API (`api.php`, `auth.php`) on the same domain — production hosting is plain PHP shared hosting.
- All data/auth access goes through `src/lib/api.ts`; it picks `mockApi.ts` (localStorage) on `*.lovable.app`, `*.lovableproject.com` and localhost, otherwise `realApi.ts`. Both implement `ApiAdapter` in `apiTypes.ts` — keep them in sync so the preview behaves like production.
- Real API responses are unwrapped tolerantly (array or `{itens|lista|dados}`; object or `{o}`) because the PHP response envelope is not fully specified.
- Routing uses TanStack Router with hash history (`#/...`) and `defaultSsr: false` (in `src/start.ts`), plus SPA mode in `vite.config.ts`, so it works on hosting without rewrite rules. API URLs are relative to the document.
- Auth guard lives in `src/routes/_authenticated.tsx` (`garantirSessao` from `src/lib/auth.ts`); users with `trocarSenha` are forced to `/trocar-senha`. 401 from guarded API calls clears the session and navigates to `/login` (wired in `src/router.tsx`).
- API errors surface as toasts via the global QueryCache/MutationCache handlers in `src/router.tsx`; forms show inline errors.
- Business logic lives in `src/domain/` as pure functions (no React) and is tested in `src/test/`; field names in `src/domain/types.ts` must not change because existing data/backups use them.
- Reusable UI building blocks live in `src/components/app/` (DataTable, RepeatableList, Field, SectionCard, ConfirmDialog, money/date/percent inputs); reuse them for new screens.
- Brazilian formatting helpers (R$ 1.234,56, dd/mm/aaaa, masks) live in `src/lib/format.ts`; never format money/dates ad hoc.
- Brand images (logo variants) are bundled from `src/assets/` via ES imports, not Lovable CDN pointers, because production runs on external PHP hosting where CDN-relative URLs would not resolve; the favicon lives in `public/`.
- Screen-specific composite components live in `src/components/<area>/` (e.g. `previsao/`, `mensal/`); domain editors shared by several screens (e.g. `demonstrativo/EditorDemonstrativo`) get their own area folder; `src/components/app/` stays for generic building blocks.
- Edital and ata forms edit `data` as dd/mm/aaaa and convert back to aaaa-mm-dd only on save (atas copy the edital date as-is), because the stored format is fixed by existing data while the UI must show Brazilian dates.
- Generated documents (PDF and Word): each document is described once as `Documento` blocks (`src/lib/documento/tipos.ts`) by a presentation-only builder in `src/documentos/` that only lays out data from domain functions; `src/lib/documento/pdf.ts` (pdfmake) and `word.ts` (docx) draw the same blocks and are imported lazily on download, and charts are SVG rasterized to PNG, so both formats stay identical and the libraries never weigh on normal pages.

- Subdirectories have their own `AGENTS.md` (e.g. `src/domain/AGENTS.md`); read it before changing files there.
