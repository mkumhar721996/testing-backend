summary: |
  HR admins can edit an existing job opening. The Backend API gains `PATCH /openings/:id` (HR admins only) that changes title and description on any opening and the vacancy count on a Draft only, and the Web App gains an "Edit job opening" screen (with the "On the public portal" preview card) reached from an Edit action on each row of the job openings list. Openings do not store a description today, so a migration adds a `description` column (existing rows get an empty string). AC5 needs something that stands for the public portal; none exists, so the plan adds a minimal unauthenticated read endpoint `GET /portal/openings` that lists Published openings, which the preview card and the AC5 test read. Work is test-first at each layer: Vitest + Fastify `inject` for the API, Vitest + Testing Library for the web pages.

scope:
  - description: |
      Migration `002_opening_description.sql`: add the description column.
      ```sql
      alter table job_openings add column description text not null default '';
      ```
    files:
      - services/api/migrations/002_opening_description.sql
    rationale: |
      AC3 and the design's Description field need stored text. The default keeps every existing row valid and readable.

  - description: |
      Domain: add `description` to `JobOpening`, add `OpeningEdit` and `VacanciesLockedError`, and an `applyEdit` function that mirrors `publish`.
      ```ts
      export interface OpeningEdit { title?: string; description?: string; vacancies?: number }
      export class VacanciesLockedError extends Error {}
      export function applyEdit(o: JobOpening, e: OpeningEdit): JobOpening  // throws VacanciesLockedError if e.vacancies !== undefined && o.status === 'Published'
      ```
    files:
      - services/api/src/openings/domain.ts
    rationale: |
      The vacancy lock (AC4) is a domain rule, so it lives next to `publish`, and both repositories share it.

  - description: |
      Repository port and both implementations.
      ```ts
      update(id: string, e: OpeningEdit): Promise<JobOpening | 'not_found' | 'vacancies_locked'>;
      listPublished(): Promise<JobOpening[]>;
      ```
      The Pg update is one statement so a concurrent publish cannot slip a vacancy change through:
      `update job_openings set title = coalesce($2, title), description = coalesce($3, description), vacancies = coalesce($4, vacancies) where id = $1 and ($4::int is null or status = 'Draft') returning id`.
      When no row is returned, `get(id)` decides between `not_found` and `vacancies_locked`. The `UUID` guard returns `not_found` for a malformed id, as `publish` does. `SELECT`, `Row` and `toOpening` gain `description`. `MemoryOpeningsRepository.update` uses `applyEdit`, and `create` sets `description: ''`.
    files:
      - services/api/src/openings/repository.ts
      - services/api/src/openings/pgRepository.ts
      - services/api/src/openings/memoryRepository.ts
    rationale: |
      Follows the existing repository-port pattern (ADR-0001, ADR-0002: only the Backend API touches PostgreSQL).

  - description: |
      Routes. `PATCH /openings/:id` uses `onRequest: requireHrAdmin`, so a non-HR user gets 403 before body validation and before the repository (AC6). Body schema: `title` and `description` strings, `vacancies` integer with minimum 1, `minProperties: 1`. Trimmed-blank title or description returns 400 with 'Enter a job title.' or 'Enter a description so candidates know what the role involves.' (copy taken from the design). Mapping: `not_found` returns 404, `vacancies_locked` returns 409 'The vacancy count is locked once an opening is published.', success returns 200 with the opening.
      `GET /portal/openings` has no authentication and returns Published openings as `{ id, title, description, vacancies }` only, with no hiring manager or status. It is registered in a separate plugin so `requireSignedIn` does not apply.
    files:
      - services/api/src/routes/openings.ts
      - services/api/src/routes/portal.ts
      - services/api/src/app.ts
    rationale: |
      Covers AC1-AC6 on the server. The portal route is the smallest thing that lets AC5 be checked; ADR-0003 concerns users signing in, and the portal is explicitly public.

  - description: |
      Document the new contract: `PATCH /openings/{id}`, `GET /portal/openings` (with `security: []`), a `description` property on `JobOpening`, and the `OpeningEdit` and `PortalOpening` schemas.
    files:
      - services/api/openapi.yaml
    rationale: |
      Keeps the published API description in step with the routes.

  - description: |
      Web API client (repo testing-fronted, `apps/web`). Add `description: string` to `JobOpening`, then:
      ```ts
      export interface OpeningEdit { title?: string; description?: string; vacancies?: number }
      export const updateOpening = (id: string, body: OpeningEdit) =>
        request<JobOpening>(`/openings/${encodeURIComponent(id)}`, { method: 'PATCH', body })
      export interface PortalOpening { id: string; title: string; description: string; vacancies: number }
      export const listPortalOpenings = () => request<PortalOpening[]>('/portal/openings')
      ```
      Add `description` to the fixtures `published` and `draft` in `testApi.ts`.
    files:
      - apps/web/src/api/openings.ts
      - apps/web/src/testApi.ts
    rationale: |
      The web app calls only the Backend API (ADR-0001).

  - description: |
      `EditOpeningPage` built from the approved prototype's "Edit job opening" screen, in the same style as `NewOpeningPage`. Props: `{ opening: JobOpening; onBack: () => void; onSaved: (o: JobOpening) => void }`. It reads `getMe()` for the HR flag.
      Layout is `.edit-layout`: a grid with the form at 3fr and the preview at 2fr from 1024px up, one column below. The page header is `h2` "Edit {title}", with sub-line "{id}, hiring manager {name}" and a ghost "Back to job openings" button.
      Form (`form-page stack`, `noValidate`) fields:
      - `Job title`, an `.input`.
      - `Description`, a `textarea.input` of 4 rows.
      - `Number of vacancies`, a number input with min 1. It is `disabled` when Published, with the hint "The vacancy count is locked once an opening is published. It stays at N.". On a Draft the hint reads "How many people you plan to hire. You can change this until the opening is published."
      - A read-only Status badge (`badge-success` when Published) with its hint.
      - Actions: primary "Save changes", which becomes "Saving…" and is disabled while pending, and a ghost "Cancel".
      Validation uses the design's inline `field-error` messages ("Enter a job title.", "Enter a description so candidates know what the role involves.", "Enter a vacancy count of 1 or more." on a Draft only), a top `alert-danger` "Your changes were not saved. Fill in the fields marked below and try again.", and focus on the first invalid field.
      Save failure shows `alert-danger` "We could not save your changes. Your edits are still in the form, so nothing is lost. Try saving again." with a "Try again" button. Loading shows the skeleton card (`role=status`, aria-label "Loading job opening").
      Non-HR: `alert-warning` with the user icon "Only HR admins can edit job openings. Your account does not have this permission, so the opening stays as it is.", every field and Save disabled, and a "Back to job openings" button.
      The vacancies value is sent only on a Draft.
    files:
      - apps/web/src/pages/EditOpeningPage.tsx
    rationale: |
      AC1-AC4 and AC6 in the UI, taken from the prototype's Edit screen.

  - description: |
      `PortalPreview` component: an `aside.card.portal-preview` with `h3` "On the public portal", a note line, and a dashed `.portal-frame` holding an `h4` title, a muted description, a `badge-success` "Open for applications" (Published only) and the "N vacancy/vacancies" meta-line. It shows only the saved values, so it changes after Save and not while typing. The note text is "Candidates see the saved title and description. Changes appear here as soon as you save." for Published, and "This opening is a draft, so it is not on the portal yet. This is how it will read once published." for Draft. After a save, "Saved just now. The portal now shows these details." appears in an `aria-live="polite"` line. For a Published opening the card takes its values from `listPortalOpenings()` after a save (AC5), and falls back to the saved opening if that call fails.
      CSS for `.edit-layout`, `.portal-preview`, `.portal-frame`, `.lock-note` and `textarea.input` is copied from the prototype's page `<style>` block into `index.css`, using the existing design tokens.
    files:
      - apps/web/src/components/PortalPreview.tsx
      - apps/web/src/index.css
    rationale: |
      The prototype marks this card as new (`data-arc-promote="portal-preview"`).

  - description: |
      Wire it in. `JobOpeningsPage` gets an `onEdit(opening)` prop. For an HR admin each row shows a secondary small "Edit" button with the sliders icon and `aria-label="Edit {title}"`, beside the existing Publish button on drafts. For a non-HR user the row shows "View" (`aria-label="View {title}"`), and the existing non-HR banner is reworded to mention that they can read but not change openings. `App` gains `view: 'edit'`, holds the opening being edited, and after a save returns to the list with the row highlighted and the toast "{title} saved. The public portal shows the new details." for Published or "{title} saved. It is still a draft." for Draft. The list refetches on return so it shows the saved values.
    files:
      - apps/web/src/pages/JobOpeningsPage.tsx
      - apps/web/src/App.tsx
    rationale: |
      Reuses the 016 table as the prototype's "Job openings" screen does (adds the Edit action).

tests:
  - |
    AC1, API (new file `services/api/test/unit/openings.edit.test.ts`, written first, fails with 404 because the route does not exist yet):
    ```ts
    const draft = await repo.create({ title: 'Designer', hiringManagerId: mgr.id, vacancies: 1 });
    const res = await app.inject({ method: 'PATCH', url: `/openings/${draft!.id}`, headers: hr, payload: { title: 'Senior Engineer' } });
    expect(res.statusCode).toBe(200);
    expect((await repo.list())[0]).toMatchObject({ title: 'Senior Engineer', status: 'Draft' });
    ```
    Also: a trimmed title is stored, a blank title returns 400, an unknown id returns 404, and a Draft vacancy change `{ vacancies: 4 }` is applied.
  - |
    AC2, API (published title edit):
    ```ts
    const o = await publishedOpening('Senior Engineer');
    await app.inject({ method: 'PATCH', url: `/openings/${o.id}`, headers: hr, payload: { title: 'Staff Engineer' } });
    expect((await repo.list())[0].title).toBe('Staff Engineer');
    ```
  - |
    AC3, API (published description edit; description defaults to '' on create and is returned by GET /openings):
    ```ts
    await app.inject({ method: 'PATCH', url: `/openings/${o.id}`, headers: hr, payload: { description: 'Backend platform role' } });
    expect((await repo.list())[0].description).toBe('Backend platform role');
    ```
    Also: a blank description returns 400.
  - |
    AC4, API (vacancy lock) plus a domain unit test in `openings.domain.test.ts`:
    ```ts
    const res = await app.inject({ method: 'PATCH', url: `/openings/${o.id}`, headers: hr, payload: { vacancies: 5 } });
    expect(res.statusCode).toBe(409);
    expect((await repo.list())[0].vacancies).toBe(3);
    // domain
    expect(() => applyEdit({ ...published, vacancies: 3 }, { vacancies: 5 })).toThrow(VacanciesLockedError);
    ```
    A combined `{ title: 'X', vacancies: 5 }` on a Published opening returns 409 and leaves the title unchanged.
  - |
    AC5, API (public portal), in `openings.portal.test.ts`:
    ```ts
    await app.inject({ method: 'PATCH', url: `/openings/${o.id}`, headers: hr, payload: { title: 'Principal Engineer' } });
    const portal = await app.inject({ method: 'GET', url: '/portal/openings' }); // no authorization header
    expect(portal.json()).toEqual([expect.objectContaining({ title: 'Principal Engineer' })]);
    ```
    A Draft is absent from the response, and the response has no `hiringManager` or `status` keys.
  - |
    AC5, web (`EditOpeningPage.test.tsx`, `mockApi`): after clicking "Save changes" with the title "Principal Engineer", `await screen.findByText('Saved just now. The portal now shows these details.')` and `expect(within(screen.getByRole('complementary')).getByRole('heading', { level: 4 })).toHaveTextContent('Principal Engineer')`. Typing in the title field before saving does not change the card.
  - |
    AC6, API (added to `openings.authz.test.ts`):
    ```ts
    const o = await publishedOpening('Senior Engineer');
    const res = await app.inject({ method: 'PATCH', url: `/openings/${o.id}`, headers: nonHr, payload: { title: 'Staff Engineer' } });
    expect(res.statusCode).toBe(403);
    expect((await repo.list())[0].title).toBe('Senior Engineer');
    ```
    Also: no token returns 401, and a non-HR user with an empty body gets 403 rather than 400.
  - |
    AC6, web: with `GET /me` returning `{ isHrAdmin: false }`, `expect(screen.getByLabelText('Job title')).toBeDisabled()` and `expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()`. In `JobOpeningsPage.test.tsx`, a non-HR user sees "View Senior Engineer" and no Edit button.
  - |
    AC1-AC4, web (`EditOpeningPage.test.tsx`): the form is filled from the opening. On a Draft the vacancies field is enabled and the PATCH body contains `vacancies`. On a Published opening `expect(screen.getByLabelText('Number of vacancies')).toBeDisabled()` and the PATCH body is `{ title, description }` with no `vacancies` key. Empty title or description shows its `field-error`, focuses the field and sends no request. A failing PATCH shows the error alert and keeps the typed values. Save shows "Saving…" while pending. In `JobOpeningsPage.test.tsx` and `App.test.tsx`, clicking "Edit Senior Engineer" opens the form and saving returns to the list with the new title and the toast.
  - |
    Data (Pg integration, `pgRepository.test.ts`, skipped without TEST_DATABASE_URL): migrate to 001 only using a temp dir containing 001, insert an opening, then apply 002 and assert the existing row is still listed with `description === ''`. Also `update` on a Draft changes title, description and vacancies, `update` of vacancies on a Published row returns `'vacancies_locked'` and leaves the row as it was, and `update('not-a-uuid', ...)` returns `'not_found'`.

assumptions_or_open_questions:
  - |
    No public portal exists in any of the three repositories (searched the API source, the web `src`, and the shared repo, which holds only a README and config). The plan adds only a minimal unauthenticated `GET /portal/openings` so AC5 can be verified. If the portal is a separate later story with its own contract, this endpoint should move to it, or the AC5 tests should assert only that the stored title changes.
  - |
    The item leaves open when edits show on the public portal. The plan follows the design (edits show immediately after save, with no review or scheduling step). This matters for the follow-up question of whether a published edit should need a re-approval.
  - |
    The item leaves open which fields can change once published. The plan follows the design: title and description are editable in both statuses, the vacancy count is editable on Draft and locked on Published (AC4), and the hiring manager and status are not editable here (the status changes only through Publish).
  - |
    Openings created before this change have no description (backfilled to an empty string). The design's form requires a description, so HR must enter one before saving an old opening, even to change only the title. Confirm this is acceptable or whether blank descriptions should be allowed on save.
  - |
    The create flow (story 016) has no description field and is not changed here, so new openings start with an empty description until edited. Confirm whether a Description field should be added to creation in another item.
  - |
    The design shows a non-HR user opening the form read-only ("View"). The API does not restrict reading openings (GET /openings is open to any signed-in user), so this is consistent, but only HR admins can save.
  - |
    The project-wide deferred questions (retention of rejected and withdrawn candidates' data, volumes and portal availability) do not affect this item. The portal availability question would matter for the unauthenticated endpoint (rate limiting, caching), which this plan does not add.

decisions:
  - decision: Add `PATCH /openings/:id` restricted to HR admins, with partial updates of title, description and vacancies.
    rationale: A partial update lets the UI send only the fields that can change, and keeps the HR check in the same `requireHrAdmin` hook as create and publish so it runs before validation.
    alternatives:
      - PUT with the full opening
      - A separate endpoint per field
    durable: true
    scope: api
    status: proposed
  - decision: Refuse a vacancy change on a Published opening with 409 instead of ignoring it silently.
    rationale: AC4 requires the stored count to stay at 3. A visible refusal avoids a client believing the change was saved, and the check is made atomically in the update statement.
    alternatives:
      - Ignore the vacancies field and return 200
    durable: true
    scope: api
    status: proposed
  - decision: Store the description in a `description text not null default ''` column added by migration 002.
    rationale: Existing rows stay valid without a backfill job, and the NOT NULL default avoids null handling in the API and UI.
    alternatives:
      - Nullable column
    durable: true
    scope: api
    status: proposed
  - decision: Expose Published openings to the portal through an unauthenticated `GET /portal/openings` that returns only id, title, description and vacancies.
    rationale: AC5 needs a public view of the saved values and none exists. Leaving out the hiring manager and status keeps the public surface minimal.
    alternatives:
      - Reuse GET /openings (requires sign-in, so not public)
      - Skip a portal endpoint and test only the stored title
    durable: true
    scope: api
    status: proposed
  - decision: Reach the database only through the Backend API; the Web App calls the API for edits and for the preview.
    rationale: Required by the accepted rules.
    alternatives: []
    durable: false
    scope: project-wide
    status: follows
    follows_adr: [ADR-0001, ADR-0002]
  - decision: Show the portal preview card from saved values only, refreshed after Save.
    rationale: Matches the prototype note that the card changes after Save and not while typing.
    alternatives:
      - Live preview while typing
    durable: false
    scope: web
    status: proposed

estimated_points: 5

package_dependencies: []

notes: |
  ### Data & rollout
  - **Existing data**: migration `002_opening_description.sql` adds `description text not null default ''`. Postgres fills existing rows with the default, so every row stays readable and listable; the migration runs in the existing transaction in `migrate.ts`. A Pg integration test checks that a row inserted before 002 is still listed afterwards.
  - **Backfill / seed**: none. The default is the backfill. The migration runner applies each file once, so re-running is safe.
  - **Settings**: none. No new env var or config file.
  - **Provisioning**: none beyond running `migrate` (`services/api/src/migrate.ts`). No new service, role or flag.
  - **Order and rollback**: migrate first, then deploy the API, then the Web App. The old API ignores the extra column, so migrating first is safe. The new Web App needs the new API, because `PATCH /openings/:id` and the `description` field must exist. To roll back, redeploy the previous images; the extra column can stay, or be removed with `alter table job_openings drop column description`.

  Repos: API changes are in `testing-backend` (home), web changes in `testing-fronted` under `apps/web`. `testing-shared` holds only a README and config, so nothing changes there. No new packages are needed.

  Design reading: the prototype's "Job openings" screen, the "Edit job opening" screen and its states (default, invalid, loading, error, not-hr) were read in full. Its sample records and `arcProto.wait(300)` are prototype shortcuts and are not carried over. Where the prototype shows a "View" action and a non-HR banner, the plan follows it; the design does not conflict with any acceptance criterion.

  ```mermaid
  flowchart TD
    App[App.tsx] --> List[JobOpeningsPage.tsx]
    App --> Edit[EditOpeningPage.tsx]
    Edit --> Preview[PortalPreview.tsx]
    Edit --> Client[api/openings.ts]
    List --> Client
    Client --> Routes[routes/openings.ts]
    Client --> Portal[routes/portal.ts]
    Routes --> Domain[openings/domain.ts]
    Routes --> Repo[openings/repository.ts]
    Portal --> Repo
    Repo --> Pg[pgRepository.ts]
    Repo --> Mem[memoryRepository.ts]
    Pg --> Mig[migrations/002_opening_description.sql]
    classDef touched fill:#f96,color:#000
    class App,List,Edit,Preview,Client,Routes,Portal,Domain,Repo,Pg,Mem,Mig touched
  ```

review_focus: |
  IN scope is editing an existing opening: title and description always, vacancies on Draft only, HR admins only, plus the Edit screen and portal preview card from the approved prototype. OUT of scope are the create flow, the sign-in flow, hiring-manager edits and a full public portal UI; the only portal work is one small unauthenticated read endpoint so AC5 is checkable. The riskiest parts are the atomic vacancy-lock check in the Pg update (it must not allow a change after publish) and the migration's effect on existing rows; the 409 on a vacancy change is deliberate (AC4).
