summary: |
  HR admins can create a job opening (title, hiring manager, vacancy count), which is saved with status Draft and shown in the job openings list, and can publish a Draft so it becomes Published and may receive applications. The Backend API (Fastify + PostgreSQL, ADR-0001/0002) owns all rules: required-field validation, the Draft/Published lifecycle, HR-admin-only authorisation on create and publish, and a domain guard that refuses applications against a Draft. The Web App (React + Vite + Tailwind, in testing-fronted) builds the approved "Job openings" and "New job opening" screens against that API. Editing and closing are out of scope (separate stories).
scope:
  - description: |
      Schema migration plus a tiny SQL migration runner (no migration tool exists in the repo today; `services/api/src/db.ts` only creates a pg Pool). New tables:
      `hiring_managers(id uuid pk default gen_random_uuid(), name text not null)` and
      `job_openings(id uuid pk default gen_random_uuid(), title text not null check (btrim(title) <> ''), hiring_manager_id uuid not null references hiring_managers(id), vacancies integer not null check (vacancies >= 1), status text not null default 'Draft' check (status in ('Draft','Published')), created_at timestamptz not null default now())`.
      Add a `migrate` script to package.json (`tsx src/migrate.ts`) that applies `migrations/*.sql` in filename order, recording applied names in a `schema_migrations` table so it is idempotent.
    files:
      - services/api/migrations/001_job_openings.sql
      - services/api/src/migrate.ts
      - services/api/package.json
    rationale: |
      Openings and hiring managers must persist in PostgreSQL via the Backend API only. Status is constrained to Draft/Published because Closed belongs to a later story (design assumption).
  - description: |
      Domain module with the opening types and rules, free of Fastify/pg so it is unit-testable.
      ```ts
      export type OpeningStatus = 'Draft' | 'Published';
      export interface JobOpening { id: string; title: string; hiringManager: { id: string; name: string }; vacancies: number; status: OpeningStatus; createdAt: string }
      export interface NewOpening { title: string; hiringManagerId: string; vacancies: number }
      export function canAcceptApplications(o: Pick<JobOpening, 'status'>): boolean  // status === 'Published'
      export function publish(o: JobOpening): JobOpening                              // Draft -> Published, throws OpeningAlreadyPublishedError otherwise
      ```
    files:
      - services/api/src/openings/domain.ts
    rationale: |
      Covers AC6/AC7/AC8 as pure logic. No applications endpoint exists yet, so `canAcceptApplications` is the single guard the future application story must call to refuse applications against a Draft.
  - description: |
      Repository port and two implementations: `OpeningsRepository { list(): Promise<JobOpening[]>; create(n: NewOpening): Promise<JobOpening | null>; publish(id: string): Promise<JobOpening | 'not_found' | 'already_published'>; listHiringManagers(): Promise<{id:string;name:string}[]> }`.
      `create` returns null when the hiring manager id does not exist. In-memory implementation is used by unit tests; the pg implementation uses the existing `createPool` from `src/db.ts` with a single `UPDATE ... SET status='Published' WHERE id=$1 AND status='Draft' RETURNING` for publish (race-safe). Lists are ordered by `created_at`.
    files:
      - services/api/src/openings/repository.ts
      - services/api/src/openings/memoryRepository.ts
      - services/api/src/openings/pgRepository.ts
    rationale: |
      Keeps SQL in one place (ADR-0002) and lets route tests run without a database, matching the existing `buildApp()` + `app.inject` test style.
  - description: |
      Auth0 token verification (ADR-0003). `src/auth.ts` exports `type Principal = { sub: string; isHrAdmin: boolean }` and `type Authenticator = (authorizationHeader: string | undefined) => Promise<Principal | null>`, plus `createAuth0Authenticator(cfg)` built on `jose` (`createRemoteJWKSet`, `jwtVerify` with issuer + audience); `isHrAdmin` is true when the token's roles claim contains the HR admin role. `config.ts` gains `auth0Issuer`, `auth0Audience`, `rolesClaim` (default `https://onboarding.example/roles` is a placeholder, see open questions) and `hrAdminRole` (default `hr_admin`), read from `AUTH0_ISSUER`, `AUTH0_AUDIENCE`, `AUTH0_ROLES_CLAIM`, `AUTH0_HR_ADMIN_ROLE`.
    files:
      - services/api/src/auth.ts
      - services/api/src/config.ts
    rationale: |
      AC9/AC10 need to tell an HR admin from any other signed-in user; the API must accept only Auth0-issued tokens.
  - description: |
      Routes and wiring. `buildApp` changes from `buildApp(): FastifyInstance` to
      `buildApp(deps: { repository: OpeningsRepository; authenticate: Authenticator }): FastifyInstance` and `server.ts` supplies the pg repository and Auth0 authenticator.
      Endpoints (all JSON, 401 with no/invalid token):
      - `GET /me` -> `{ isHrAdmin: boolean }` (lets the Web App show the design's "not-hr" states without decoding tokens)
      - `GET /hiring-managers` -> `[{ id, name }]`
      - `GET /openings` -> `JobOpening[]` (any signed-in user; the design lets non-HR users view the list)
      - `POST /openings` body `{ title, hiringManagerId, vacancies }` -> 201 `JobOpening` with `status: 'Draft'`; 400 on missing/blank title, missing hiringManagerId, missing/non-integer/<1 vacancies, or unknown hiring manager; 403 for non-HR
      - `POST /openings/:id/publish` -> 200 `JobOpening` with `status: 'Published'`; 403 non-HR; 404 unknown id; 409 if already Published
      Body validated with a Fastify JSON schema (`required`, `minLength: 1`, `vacancies` `type: integer, minimum: 1`) plus a `title.trim()` check. The authorisation check runs before validation and before any repository call so a non-HR request can never create or publish.
    files:
      - services/api/src/app.ts
      - services/api/src/server.ts
      - services/api/src/routes/openings.ts
      - services/api/src/routes/me.ts
    rationale: |
      Implements AC1-AC7, AC9, AC10 at the HTTP layer. The health test must be updated to the new `buildApp` signature.
  - description: |
      Web App screens, built from the approved prototype (Job openings screen and New job opening screen; sidebar shell with Overview/Boards/My tasks/Settings is the prototype's app shell and is not part of this story, so render only the page content inside the existing `App`). Keep a simple in-component `view` state ('list' | 'new') rather than adding a router.
      - `src/api/openings.ts`: typed fetch client for `/me`, `/hiring-managers`, `/openings`, `POST /openings`, `POST /openings/:id/publish`; base URL from `VITE_API_BASE_URL` (default `http://localhost:3000`); bearer token from an injectable `getAccessToken` provider.
      - `src/pages/JobOpeningsPage.tsx`: `.page-header` with h2 "Job openings", muted sub-line "Applications can only be made against published openings." and a primary "New job opening" button with plus icon (disabled/hidden for non-HR is NOT drawn; the design shows the button and a warning alert, so keep the button but show the warning). States: loading (three skeleton rows, `role=status`, label "Loading job openings"), empty (card with h3 "No job openings yet", copy "Create an opening to name the role, its hiring manager and how many vacancies it covers." and a "Create a job opening" button), error (danger alert "We could not load job openings. Check your connection and try again." with a "Try again" secondary button that refetches), default (info alert "Draft openings refuse applications. Publish an opening when it is ready to receive them.", a count line "N openings, M in draft" with `aria-live=polite`, and a table with columns Opening (title plus muted id line), Hiring manager, Vacancies (right aligned), Status (badge: Draft neutral, Published green success), Action (right aligned secondary small "Publish" button on Draft rows only, aria-label "Publish <title>")), not-hr (warning alert "Only HR admins can create or publish job openings. Ask an HR admin if an opening needs to go live." and the Publish buttons disabled with aria-label "Publish <title>, HR admins only").
      - `src/components/PublishDialog.tsx`: modal (role=dialog, aria-modal, titled "Publish this opening?") with body "“<title>” is a draft, so applications are refused today. Once published, candidates can apply against it.", primary "Publish opening" (shows "Publishing…" and is disabled while in flight) and ghost "Cancel"; Escape/backdrop closes. On success refresh the row, close, and toast "<title> published. Applications can now be made against it.".
      - `src/pages/NewOpeningPage.tsx`: `form-page` (max width 768px), h2 "New job opening", muted "The opening is saved as a draft. Publish it from the list when it is ready." Fields: Job title (input), Hiring manager (select, first option "Choose a hiring manager", options from `/hiring-managers`), Number of vacancies (number input min 1 step 1, hint "How many people you plan to hire into this role."), read-only Status row with a "Draft" badge and hint "New openings start as drafts and do not accept applications." Actions: primary "Create opening" ("Creating…" while saving), secondary "Create and add another", ghost "Cancel". Invalid state: client validation mirrors the API, field errors "Enter a job title.", "Choose a hiring manager.", "Enter a vacancy count of 1 or more." with `aria-invalid`, a danger alert "The opening was not created. Fill in the fields marked below and try again.", focus moves to the first invalid field and input is kept. Not-hr state: warning alert "Only HR admins can create job openings. Your account does not have this permission." with disabled fields and a "Back to job openings" ghost button. API 400/403 responses also surface through the same alert. Success: toast "<title> created as a draft. Publish it when it is ready for applications." and return to the list with the new row highlighted (primary-soft background); "Create and add another" resets the form, refocuses the title and toasts "... Add the next one."
      - `src/components/Toast.tsx` small status toast (bottom centre, dark surface).
      - `src/App.tsx` renders the two pages; `src/index.css` adds the design tokens used (primary #0369a1, primary-soft #e6f0f6, success-soft #def2e6 / text #117b38, warning-soft #faecdc / text #9d5604, danger-soft #fae1e1 / text #ca2121, border #dee3e7, Inter font) as a Tailwind `@theme` block; style with Tailwind utilities only.
      - Replace the prototype's hard-coded seed (JO-101/JO-102, the four manager names) with API data; no fixtures in production code.
    files:
      - apps/web/src/api/openings.ts
      - apps/web/src/pages/JobOpeningsPage.tsx
      - apps/web/src/pages/NewOpeningPage.tsx
      - apps/web/src/components/PublishDialog.tsx
      - apps/web/src/components/Toast.tsx
      - apps/web/src/App.tsx
      - apps/web/src/index.css
    rationale: |
      Delivers the approved design against real data. The web app never talks to the database (ADR-0001); it only calls the Backend API. These files are in the testing-fronted repository.
  - description: |
      Update existing tests for the new `buildApp` signature and the replaced App heading, and add Playwright e2e for the happy path (create then publish).
    files:
      - services/api/test/unit/health.test.ts
      - apps/web/src/App.test.tsx
      - apps/web/e2e/app.spec.ts
    rationale: |
      `buildApp()` now requires dependencies and `App` no longer renders the `comp_web_app` placeholder heading.
tests:
  - |
    AC1 (API, services/api/test/unit/openings.create.test.ts, written first, fails because POST /openings does not exist):
    ```ts
    const created = await app.inject({ method: 'POST', url: '/openings', headers: hr, payload: { title: 'Senior backend engineer', hiringManagerId: mgr.id, vacancies: 2 } });
    expect(created.statusCode).toBe(201);
    const list = await app.inject({ method: 'GET', url: '/openings', headers: hr });
    expect(list.json().map((o: any) => o.id)).toContain(created.json().id);
    ```
  - |
    AC2 (openings.publish.test.ts): after publish, the opening is eligible for applications.
    ```ts
    const res = await app.inject({ method: 'POST', url: `/openings/${draft.id}/publish`, headers: hr });
    expect(res.statusCode).toBe(200);
    expect(canAcceptApplications(res.json())).toBe(true);
    ```
  - |
    AC3 (it.each in openings.create.test.ts), each of title, hiringManagerId, vacancies omitted (plus blank title, vacancies 0 and 1.5):
    ```ts
    const res = await app.inject({ method: 'POST', url: '/openings', headers: hr, payload });
    expect(res.statusCode).toBe(400);
    expect((await repo.list())).toHaveLength(0);
    ```
  - |
    AC4 (openings.create.test.ts):
    ```ts
    expect(created.json().hiringManager).toEqual({ id: mgr.id, name: mgr.name });
    ```
    and unknown hiring manager id returns 400 and creates nothing.
  - |
    AC5 (openings.create.test.ts):
    ```ts
    const res = await app.inject({ method: 'POST', url: '/openings', headers: hr, payload: { title: 'T', hiringManagerId: mgr.id, vacancies: 3 } });
    expect(res.json().vacancies).toBe(3);
    ```
  - |
    AC6 (openings.create.test.ts):
    ```ts
    expect(created.json().status).toBe('Draft');
    ```
  - |
    AC7 (openings.publish.test.ts) plus domain test (test/unit/openings.domain.test.ts):
    ```ts
    expect(res.json().status).toBe('Published');
    expect(() => publish({ ...published })).toThrow(OpeningAlreadyPublishedError);
    ```
    and route returns 409 on a second publish, 404 for an unknown id.
  - |
    AC8 (test/unit/openings.domain.test.ts):
    ```ts
    expect(canAcceptApplications({ status: 'Draft' })).toBe(false);
    expect(canAcceptApplications({ status: 'Published' })).toBe(true);
    ```
  - |
    AC9 (openings.authz.test.ts): non-HR token and missing token.
    ```ts
    const res = await app.inject({ method: 'POST', url: '/openings', headers: nonHr, payload: valid });
    expect(res.statusCode).toBe(403);
    expect(await repo.list()).toHaveLength(0);
    expect((await app.inject({ method: 'POST', url: '/openings', payload: valid })).statusCode).toBe(401);
    ```
  - |
    AC10 (openings.authz.test.ts):
    ```ts
    const res = await app.inject({ method: 'POST', url: `/openings/${draft.id}/publish`, headers: nonHr });
    expect(res.statusCode).toBe(403);
    expect((await repo.list())[0].status).toBe('Draft');
    ```
  - |
    Auth (test/unit/auth.test.ts): `createAuth0Authenticator` with a locally generated key set (jose `generateKeyPair` and a stubbed JWKS) returns `{ isHrAdmin: true }` for a token carrying the HR role, `{ isHrAdmin: false }` without it, and `null` for a wrong issuer, wrong audience, or expired token. `GET /me` returns that flag.
  - |
    PG repository (test/integration/pgRepository.test.ts, runs only when `TEST_DATABASE_URL` is set, otherwise `describe.skip`; vitest include pattern already matches `test/**`): after `migrate`, create then list returns the row with status Draft, and publish is a no-op `already_published` on the second call.
  - |
    Web, AC1/AC4/AC5/AC6 (apps/web/src/pages/JobOpeningsPage.test.tsx, vitest + Testing Library, fetch mocked): the list renders a row with the manager name, vacancy count and a Draft badge.
    ```tsx
    expect(await screen.findByText('Tomas Eriksen')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    ```
    Also loading shows `getByRole('status', { name: 'Loading job openings' })`, an empty response shows `No job openings yet`, and a rejected fetch shows the danger alert and `Try again` refetches.
  - |
    Web, AC3 (NewOpeningPage.test.tsx): submitting with all fields empty shows the three field errors and does not call the API.
    ```tsx
    fireEvent.click(screen.getByRole('button', { name: 'Create opening' }));
    expect(await screen.findByText('Enter a job title.')).toBeInTheDocument();
    expect(screen.getByText('Choose a hiring manager.')).toBeInTheDocument();
    expect(screen.getByText('Enter a vacancy count of 1 or more.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/openings'), expect.objectContaining({ method: 'POST' }));
    ```
  - |
    Web, AC2/AC7 (JobOpeningsPage.test.tsx): clicking `Publish Product designer` opens the dialog, confirming posts to `/openings/:id/publish`, the row badge becomes `Published` and the Publish button disappears.
  - |
    Web, AC9/AC10 (both page tests): when `/me` returns `{ isHrAdmin: false }` the warning alerts appear, Publish buttons are disabled (`expect(screen.getByRole('button', { name: 'Publish Product designer, HR admins only' })).toBeDisabled()`) and the New opening form fields and submit are disabled.
  - |
    E2E (apps/web/e2e/app.spec.ts, Playwright): as an HR admin, create an opening, see it in the list as Draft, publish it, see Published. Needs the API and a test Auth0 token source, see open questions.
assumptions_or_open_questions:
  - |
    Auth0 sign-in in the Web App is assumed to belong to another story: no Auth0 SDK or session exists in testing-fronted today (I read App.tsx and package.json). The Web App therefore consumes an injectable `getAccessToken` provider and does not add `@auth0/auth0-react`. Please confirm, or add the sign-in work here (it would add that package and a callback route).
  - |
    How an HR admin is identified is not defined anywhere I could read. I assumed an Auth0 role `hr_admin` delivered in a custom roles claim whose namespace is configurable (`AUTH0_ROLES_CLAIM`). The real claim name/role and the Auth0 Action that adds it need to be confirmed.
  - |
    Hiring manager link: the item leaves it open. The design shows a dropdown of a fixed list of people, so I modelled `hiring_managers(id, name)` and a foreign key. There is no users/people store yet, so who populates `hiring_managers` (a seed, an import, or the Auth0 user list) is undecided. I did not invent seed names. Until it is populated the dropdown is empty and no opening can be created. Please decide the source, or whether hiring manager should instead be a free-text name.
  - |
    Vacancy count is treated as a whole number of 1 or more (the design's assumption). No upper bound is set.
  - |
    Statuses are Draft and Published only; Closed is story 018. Publishing an already Published opening returns 409 (not specified in the ACs).
  - |
    AC8 and the "applications can be made" half of AC2: there is no applications model or endpoint yet. I deliver the `canAcceptApplications` domain guard with tests and expect the application story to call it. I did not add a placeholder applications endpoint. Please confirm that is acceptable.
  - |
    The prototype's sidebar shell (Overview/Boards/My tasks/Settings) has no "Job openings" entry; the prototype itself flags this as a design-system gap. I do not build the shell or navigation in this story; the two pages render inside the existing `App`, with a simple view state instead of a router. The prototype's header and footer are likewise not built here.
  - |
    Non-HR users can view the list but not create or publish (design assumption); AC9/AC10 are enforced server-side, the disabled UI is a convenience only.
  - |
    No database or Auth0 tenant is available to the unit test command (`cd services/api && pnpm test`), so unit tests use the in-memory repository and a locally signed JWKS; pg integration tests are skipped without `TEST_DATABASE_URL`.
  - |
    Deferred project-wide questions (candidate data retention; expected volumes and portal availability) do not affect this story: no candidate data is stored and the list is not paginated. Volumes should be confirmed before the list endpoint needs pagination.
estimated_points: 8
package_dependencies:
  - name: jose
    version: ^5.9.0
    ecosystem: npm
    component_id: comp_backend_api
    repo: testing-backend
    rationale: Verifies Auth0-issued JWTs (JWKS fetch, signature, issuer and audience) as required by ADR-0003; also used in tests to sign tokens. Not currently a dependency of services/api.
notes: |
  ### Data & rollout

  - **Existing data**: None — the migration only creates two new tables (`hiring_managers`, `job_openings`) and touches no existing table, so no existing rows are affected. (I found no other migrations in `services/api`; the repo has only `src/db.ts` creating a pool.)
  - **Backfill / seed**: No backfill. `hiring_managers` must be populated before anyone can create an opening (open question above); whatever populates it should be idempotent, e.g. `INSERT ... ON CONFLICT DO NOTHING`. The runner itself is idempotent through `schema_migrations`.
  - **Settings**: `AUTH0_ISSUER`, `AUTH0_AUDIENCE` (no safe default; the API must refuse to start, or reject every token, when unset), `AUTH0_ROLES_CLAIM`, `AUTH0_HR_ADMIN_ROLE` (default `hr_admin`) in `services/api/src/config.ts`; web `VITE_API_BASE_URL` (default `http://localhost:3000`). `DATABASE_URL` already exists. Document them in the API and web README or `.env.example` if the repos have one.
  - **Provisioning**: Auth0 API (audience) and an `hr_admin` role assigned to HR admins, with an Action that puts roles in the token; the PostgreSQL database; the hiring managers source.
  - **Order and rollback**: Run `pnpm migrate` before deploying the new API image (ADR-0004: containers on AWS). The new tables are additive, so rolling back the code is safe with the tables left in place; to remove them, drop `job_openings` then `hiring_managers`.

  ### Approach

  The design is a clickable prototype with sample data and invented behaviours (`arcProto.wait`, seeded JO-101/JO-102). None of that is carried into production; data comes from the API. Prototype conflict to note: AC3 says the opening is "not created" when a field is missing, and the design adds a client-side check with the same outcome; the API is still the authority and both are tested. The prototype's "Create and add another" button is not in the ACs but is in the approved design, so it is included.

  ```mermaid
  flowchart TD
    Server[server.ts] --> App[app.ts buildApp]
    App --> Health[routes/health.ts]
    App --> OpenRoutes[routes/openings.ts]
    App --> MeRoute[routes/me.ts]
    OpenRoutes --> Auth[auth.ts Auth0 verify]
    OpenRoutes --> Domain[openings/domain.ts]
    OpenRoutes --> Repo[openings/repository.ts port]
    Repo --> PgRepo[openings/pgRepository.ts]
    Repo --> MemRepo[openings/memoryRepository.ts tests]
    PgRepo --> Db[db.ts createPool]
    Server --> Config[config.ts]
    Migrate[migrate.ts] --> Sql[migrations/001_job_openings.sql]
    Web[apps/web pages] --> Client[api/openings.ts]
    Client -->|HTTP| OpenRoutes
    classDef touched fill:#f96,color:#000
    class Server,App,OpenRoutes,MeRoute,Auth,Domain,Repo,PgRepo,MemRepo,Config,Migrate,Sql,Web,Client touched
  ```

  Orange nodes are new or modified; `health.ts` and `db.ts` are existing context. Web files live in testing-fronted, everything else in testing-backend. Nothing is needed in testing-shared (it holds only a README and config, which I read).
review_focus: |
  IN: create, publish, list, HR-only authorisation, Draft/Published lifecycle, `canAcceptApplications` guard, and the two approved screens with all listed states. OUT: editing, closing, an applications endpoint, Auth0 sign-in in the Web App, the app shell/navigation. Riskiest areas are the authorisation order (403 before validation and before any write, enforced server-side) and the unresolved hiring-manager source and HR role claim, which the plan deliberately leaves configurable. The `buildApp` signature change is intentional and requires updating the existing health test.
