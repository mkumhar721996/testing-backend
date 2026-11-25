summary: |
  Introduce the minimal Application record in the Backend API and tie each one to exactly one Job Opening. An application is created through `POST /applications` with a required `openingId`; it is refused when the opening is missing, unknown or still a Draft (reusing the existing `canAcceptApplications` guard). It is stored with a NOT NULL foreign key to `job_openings`, and read back through `GET /applications` and `GET /applications/:id`, which include the opening's title. A candidate who already has an application for a different opening gets a separate application only when the request carries an explicit confirmation; otherwise it is refused with 409. Full application intake (form fields, documents, candidate profiles) stays with the Application intake epic.
scope:
  - description: |
      Domain types and rules for an application. Add to `domain.ts` (or a new `applications/domain.ts`):
      ```ts
      export interface Application {
        id: string;
        openingId: string;
        openingTitle: string;
        candidateName: string;
        candidateEmail: string; // trimmed + lower-cased; the candidate key until intake defines a candidate record
        createdAt: string;
      }
      export interface NewApplication {
        openingId: string;
        candidateName: string;
        candidateEmail: string;
        confirmAdditionalOpening?: boolean;
      }
      export type CreateApplicationResult =
        | Application
        | 'opening_not_found'
        | 'opening_not_published'
        | 'confirmation_required';
      ```
    files:
      - services/api/src/applications/domain.ts
    rationale: |
      Keeps the opening link and the result outcomes explicit and shared by both repository implementations.
  - description: |
      Repository port plus two implementations, mirroring the openings ones.
      ```ts
      export interface ApplicationsRepository {
        create(n: NewApplication): Promise<CreateApplicationResult>;
        list(): Promise<Application[]>;
        get(id: string): Promise<Application | null>;
      }
      ```
      Memory implementation takes the `OpeningsRepository` in its constructor and uses `list()` plus `canAcceptApplications`. Pg implementation does the work in one transaction. It locks the opening row, then checks status. It then counts existing applications for the same email on other openings and requires confirmation when the count is above zero.
    files:
      - services/api/src/applications/repository.ts
      - services/api/src/applications/memoryRepository.ts
      - services/api/src/applications/pgRepository.ts
    rationale: |
      Same port/adapter split as openings so unit tests run without Postgres (ADR-0002: only the Backend API touches the database).
  - description: |
      Migration `002_applications.sql`:
      ```sql
      create table applications (
        id uuid primary key default gen_random_uuid(),
        opening_id uuid not null references job_openings (id),
        candidate_name text not null check (btrim(candidate_name) <> ''),
        candidate_email text not null check (btrim(candidate_email) <> ''),
        created_at timestamptz not null default now()
      );
      create index applications_candidate_email_idx on applications (candidate_email);
      create index applications_opening_id_idx on applications (opening_id);
      ```
    files:
      - services/api/migrations/002_applications.sql
    rationale: |
      NOT NULL plus a foreign key enforces "exactly one opening" at the storage layer, not only in the route.
  - description: |
      Routes in `routes/applications.ts`, registered in `app.ts`; `AppDeps` gains `applications: ApplicationsRepository`; `server.ts` wires `PgApplicationsRepository`.
      `POST /applications` has a body schema requiring `openingId`, `candidateName` and `candidateEmail`, and allowing an optional boolean `confirmAdditionalOpening`. The `openingId` field being absent yields 400 `{ error: 'Choose an opening.' }`. Outcomes map as: `opening_not_found` → 404, `opening_not_published` → 409, `confirmation_required` → 409 with `code: 'confirmation_required'`, success → 201. Sending `confirmAdditionalOpening: true` requires a signed-in staff principal; an anonymous caller with it gets 401. Without the flag the route does not require sign-in (candidate submission).
      `GET /applications` and `GET /applications/:id` require sign-in (the existing `requireSignedIn` pattern, hoisted or duplicated) and return `openingTitle`.
    files:
      - services/api/src/routes/applications.ts
      - services/api/src/app.ts
      - services/api/src/server.ts
    rationale: |
      Business logic stays in the Backend API (ADR-0001); the existing auth hook pattern is reused.
  - description: |
      Test helpers: extend `setup()` to also build a `MemoryApplicationsRepository` over the same openings repo and pass it to `buildApp`; add a helper that creates and publishes an opening. Existing tests keep working.
    files:
      - services/api/test/unit/helpers.ts
    rationale: |
      `buildApp` now requires the applications dependency.
tests:
  - |
    AC1 (services/api/test/unit/applications.create.test.ts) — fails first because `/applications` does not exist.
    ```ts
    const opening = await createPublishedOpening(app);
    const res = await app.inject({ method: 'POST', url: '/applications', payload: { openingId: opening.id, candidateName: 'Ada', candidateEmail: 'ada@example.com' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().openingId).toBe(opening.id);
    // a Draft opening is refused
    const draft = (await app.inject({ method: 'POST', url: '/openings', headers: hr, payload: valid })).json();
    const refused = await app.inject({ method: 'POST', url: '/applications', payload: { openingId: draft.id, candidateName: 'Ada', candidateEmail: 'ada@example.com' } });
    expect(refused.statusCode).toBe(409);
    ```
  - |
    AC2 (services/api/test/unit/applications.view.test.ts) — staff view carries the title.
    ```ts
    const got = await app.inject({ method: 'GET', url: `/applications/${created.id}`, headers: nonHr });
    expect(got.json().openingTitle).toBe(opening.title);
    const list = await app.inject({ method: 'GET', url: '/applications', headers: nonHr });
    expect(list.json()[0].openingTitle).toBe(opening.title);
    expect((await app.inject({ method: 'GET', url: '/applications' })).statusCode).toBe(401);
    ```
  - |
    AC3 (services/api/test/unit/applications.create.test.ts) — no opening, nothing created.
    ```ts
    const res = await app.inject({ method: 'POST', url: '/applications', payload: { candidateName: 'Ada', candidateEmail: 'ada@example.com' } });
    expect(res.statusCode).toBe(400);
    expect(await repo.list()).toHaveLength(0);
    ```
    Also an unknown `openingId` returns 404 and creates nothing.
  - |
    AC4 (services/api/test/unit/applications.multiple.test.ts) — confirmed second application is separate.
    ```ts
    const res = await app.inject({ method: 'POST', url: '/applications', headers: nonHr, payload: { ...second, confirmAdditionalOpening: true } });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).not.toBe(first.id);
    expect((await applications.list()).map((a) => a.openingId).sort()).toEqual([openingA.id, openingB.id].sort());
    ```
    Email matching is case-insensitive (`ADA@example.com` hits `ada@example.com`).
  - |
    AC5 (services/api/test/unit/applications.multiple.test.ts) — unconfirmed is refused.
    ```ts
    const res = await app.inject({ method: 'POST', url: '/applications', payload: second });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('confirmation_required');
    expect(await applications.list()).toHaveLength(1);
    // anonymous caller cannot self-confirm
    const anon = await app.inject({ method: 'POST', url: '/applications', payload: { ...second, confirmAdditionalOpening: true } });
    expect(anon.statusCode).toBe(401);
    ```
  - |
    Integration (services/api/test/integration/pgApplications.test.ts, skipped without TEST_DATABASE_URL) — the same AC1, AC3, AC4 and AC5 outcomes against Postgres, plus the migration check that existing `job_openings` rows remain readable after 002 is applied.
    ```ts
    await expect(pool.query('insert into applications (opening_id, candidate_name, candidate_email) values (null, $1, $2)', ['Ada', 'a@b.c'])).rejects.toThrow();
    ```
assumptions_or_open_questions:
  - |
    Candidate identity is not defined anywhere yet (no candidates table; intake is a separate epic). This plan uses the normalised email as the candidate key for "same candidate". Confirm that is acceptable until the Application intake epic introduces a candidate record.
  - |
    Who confirms: the plan lets only a signed-in staff principal send `confirmAdditionalOpening: true`. Confirm staff (not only HR admins) may confirm, and whether the Web App will expose a confirmation step.
  - |
    A second application by the same candidate to the SAME opening is not specified by the story; the plan does not add a rule or unique constraint for it.
  - |
    The staff view in the Web App (testing-fronted) and the shared types (testing-shared) are not changed: AC2 is met by the API returning `openingTitle`. Confirm whether a staff application screen belongs to this story or to the Application intake epic.
  - |
    The deferred project-wide questions (retention of rejected or withdrawn candidates' data, expected volumes and portal availability) do not change this plan. Candidate personal data (name, email) is stored with no retention rule yet, so those questions stay open.
decisions:
  - decision: Enforce the opening link with a NOT NULL foreign key on applications.opening_id
    rationale: Makes "exactly one opening" true in storage as well as in the route.
    alternatives:
      - Validate only in the route
      - Join table allowing many openings per application
    durable: true
    scope: api
    status: follows
    follows_adr: [ADR-0002]
  - decision: Use the normalised candidate email as the candidate key and a request flag confirmAdditionalOpening for staff confirmation
    rationale: No candidate entity exists yet; this is the smallest thing that satisfies AC4 and AC5 and is easy to replace once intake defines candidates.
    alternatives:
      - Create a candidates table now
      - A separate confirmation endpoint
    durable: true
    scope: api
    status: proposed
  - decision: Refuse applications to a Draft opening using the existing canAcceptApplications guard
    rationale: The guard was written for this story and keeps one source of truth for what a published opening accepts.
    alternatives:
      - Re-check status in the repository
    durable: false
    scope: api
    status: proposed
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: `002_applications.sql` only creates a new table; existing `job_openings` and `hiring_managers` rows are untouched. There are no existing applications, so the NOT NULL column and the foreign key hit no old rows.
  - **Backfill / seed**: None needed.
  - **Settings**: None — no new env vars.
  - **Provisioning**: None beyond running the migration with `pnpm` script `migrate` (`services/api/src/migrate.ts`), which applies `migrations/*.sql` once each.
  - **Order and rollback**: Migrate first, then deploy the new API code. Rollback: redeploy the old code (it ignores the table) and, if wanted, `drop table applications`. A down migration is not part of the existing migration runner.

  The test command is `cd services/api && pnpm test`; run each new file narrowly, for example `cd services/api && pnpm test test/unit/applications.create.test.ts`.

  ```mermaid
  flowchart TD
    server[src/server.ts] --> app[src/app.ts]
    app --> appsRoutes[routes/applications.ts]
    app --> openRoutes[routes/openings.ts]
    appsRoutes --> appsRepo[applications/repository.ts]
    appsRepo --> pgApps[applications/pgRepository.ts]
    appsRepo --> memApps[applications/memoryRepository.ts]
    memApps --> openRepo[openings/repository.ts]
    appsRoutes --> domain[openings/domain.ts canAcceptApplications]
    pgApps --> mig[migrations/002_applications.sql]
    classDef touched fill:#f96,color:#000
    class server,app,appsRoutes,appsRepo,pgApps,memApps,mig touched
  ```
review_focus: |
  IN: the backend link between an application and one opening, the title on staff reads, refusal without or with a Draft opening, and the confirm-or-refuse rule for a second opening. OUT: intake form, documents, candidate profiles, Web App screens, retention. Riskiest part is the Pg duplicate check and confirmation under concurrent requests; the plan runs it in one transaction with the opening row locked. Candidate identity by email is a deliberate stopgap, listed as an open question.
