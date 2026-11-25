summary: |
  HR admins can close a Published job opening so it stops accepting applications. The backend API gets a new `Closed` opening status, an HR-only `POST /openings/:id/close` endpoint, a migration widening the status check constraint, and `canAcceptApplications` now refuses Closed openings (the single guard the future application story must call). Closed openings stay in `GET /openings` with status `Closed`, so the portal can list them marked as closed. Closing touches only the opening row, so applications in progress are left alone. The web app gets a `Closed` type, a `closeOpening` client call, a HR-only Close button on published rows and a Closed badge.
scope:
  - description: |
      Domain: widen the status type, add a close transition and make the application guard refuse Closed.
      ```ts
      export type OpeningStatus = 'Draft' | 'Published' | 'Closed';
      export class OpeningNotPublishedError extends Error { /* name = 'OpeningNotPublishedError' */ }
      export function close(o: JobOpening): JobOpening; // Published -> Closed, otherwise throws OpeningNotPublishedError
      ```
      `canAcceptApplications` stays `o.status === 'Published'`, which already refuses Closed (AC4); update its comment.
    files:
      - services/api/src/openings/domain.ts
    rationale: |
      Keeps the status rules in one pure module, mirroring publish().
  - description: |
      Repository contract and both implementations.
      ```ts
      close(id: string): Promise<JobOpening | 'not_found' | 'not_published'>;
      ```
      Memory repo uses the domain `close()`. Pg repo runs `update job_openings set status = 'Closed' where id = $1 and status = 'Published' returning id`, then re-reads; when nothing updated it returns 'not_found' (no row or bad UUID) or 'not_published' (row exists). Only the opening row is written, so no application is touched (AC3).
    files:
      - services/api/src/openings/repository.ts
      - services/api/src/openings/memoryRepository.ts
      - services/api/src/openings/pgRepository.ts
    rationale: |
      Mirrors publish(), including the conditional UPDATE so a concurrent double close is safe.
  - description: |
      Migration 002 widens the status check constraint. Constraint name is the Postgres default `job_openings_status_check`.
      ```sql
      alter table job_openings drop constraint job_openings_status_check;
      alter table job_openings add constraint job_openings_status_check
        check (status in ('Draft', 'Published', 'Closed'));
      ```
    files:
      - services/api/migrations/002_job_opening_closed_status.sql
    rationale: |
      Without it the Pg update to 'Closed' violates the check. migrate.ts applies files in filename order, once each, inside a transaction.
  - description: |
      Route `POST /openings/:id/close` with `onRequest: requireHrAdmin` (403 before any repository call, AC2). 200 with the Closed opening; 404 'Opening not found.'; 409 'Only a published opening can be closed.' Add the path to openapi.yaml and `Closed` to the JobOpening status enum.
    files:
      - services/api/src/routes/openings.ts
      - services/api/openapi.yaml
    rationale: |
      Same shape as the publish route and its authorisation hook.
  - description: |
      Web app: `OpeningStatus` gains 'Closed'; add `closeOpening(id)` posting to `/openings/:id/close`; on the openings page show a Close button (HR admins only, on Published rows), a Closed badge, update the row via the same replace-by-id state update as publish, and show a toast `<title> closed. It no longer accepts applications.` The Draft count line is unchanged.
    files:
      - apps/web/src/api/openings.ts
      - apps/web/src/pages/JobOpeningsPage.tsx
      - apps/web/src/pages/JobOpeningsPage.test.tsx
    rationale: |
      AC1 says the opening is shown as closed; the page is where HR sees status. Repository to edit is testing-fronted.
tests:
  - |
    AC1, services/api/test/unit/openings.close.test.ts. Write first, fails with 404 until the route exists.
    ```ts
    const res = await app.inject({ method: 'POST', url: `/openings/${opening.id}/close`, headers: hr });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('Closed');
    expect((await repo.list())[0].status).toBe('Closed');
    ```
  - |
    AC2, extend services/api/test/unit/openings.authz.test.ts. A non-HR user gets 403 and the opening stays Published; no token gets 401.
    ```ts
    const res = await app.inject({ method: 'POST', url: `/openings/${opening.id}/close`, headers: nonHr });
    expect(res.statusCode).toBe(403);
    expect((await repo.list())[0].status).toBe('Published');
    ```
  - |
    AC3, openings.close.test.ts. There is no application entity in the API yet, so assert closing changes only status and nothing else on the opening, and note that the future application story must not touch applications on close.
    ```ts
    const { status, ...rest } = closed; const { status: _s, ...before } = published;
    expect(rest).toEqual(before);
    ```
  - |
    AC4, services/api/test/unit/openings.domain.test.ts. The guard refuses a Closed opening.
    ```ts
    expect(canAcceptApplications(close(publishedOpening))).toBe(false);
    expect(() => close(draftOpening)).toThrow(OpeningNotPublishedError);
    ```
    Also in openings.close.test.ts, a second close returns 409 and an unknown id returns 404.
  - |
    AC5, openings.close.test.ts. A closed opening is still listed, marked Closed.
    ```ts
    const list = await app.inject({ method: 'GET', url: '/openings', headers: nonHr });
    expect(list.json()).toEqual([expect.objectContaining({ id: opening.id, status: 'Closed' })]);
    ```
  - |
    AC6, openings.close.test.ts. A Published opening with vacancies 3 that nobody closes stays Published, and a failed non-HR attempt does not change that.
    ```ts
    expect(opening.vacancies).toBe(3);
    expect((await repo.list())[0].status).toBe('Published');
    expect(canAcceptApplications((await repo.list())[0])).toBe(true);
    ```
  - |
    Pg integration (skipped without TEST_DATABASE_URL), extend services/api/test/integration/pgRepository.test.ts: after migrate(), publish then close returns status Closed, a second close returns 'not_published', close of a Draft returns 'not_published', close of a random UUID returns 'not_found'. Rows that existed before migration 002 (Draft/Published) remain readable.
  - |
    Web, apps/web/src/pages/JobOpeningsPage.test.tsx. HR sees Close on a published row, clicking it posts to /openings/o1/close and the row shows Closed; non-HR sees no enabled Close button.
    ```ts
    await user.click(await screen.findByRole('button', { name: 'Close Backend engineer' }))
    expect(await screen.findByText('Closed')).toBeInTheDocument()
    ```
assumptions_or_open_questions:
  - |
    AC5 says a candidate views the public portal. No portal or unauthenticated endpoint exists today (GET /openings requires sign-in, services/api/src/routes/openings.ts). This plan makes closed openings stay in GET /openings with status Closed and does not build a public portal or public endpoint. Is a portal story separate, and should it show Draft openings?
  - |
    AC3 and AC4 reference applications, but no application entity, table or endpoint exists in the repository yet. They are covered through the `canAcceptApplications` guard and by closing writing only the opening row. The application story must call the guard and must leave in-progress applications untouched when an opening closes.
  - |
    Can a Closed opening be reopened, and can a Draft be closed? Plan assumes neither (Closed is terminal, only Published can be closed). Say if reopening is wanted.
  - |
    Retention of rejected and withdrawn candidates' data, and expected volumes and portal availability, are project-wide planning questions that this story does not touch; left unanswered.
  - |
    The item's `testing-shared` repository has no relevant code (searched for Published/publish, no matches), so nothing changes there.
decisions:
  - decision: Add a terminal Closed status to the opening and make Closed openings remain in the list endpoint.
    rationale: AC5 wants closed openings listed and marked closed; a status value is the minimal model and the existing guard already refuses anything not Published.
    alternatives:
      - A separate closed_at boolean column next to status
      - Hiding closed openings from the list
    durable: true
    scope: api
    status: proposed
  - decision: Expose closing as POST /openings/:id/close guarded by the HR admin hook, answering 404 and 409 like publish.
    rationale: Same API shape and authorisation as the publish endpoint keeps clients and tests uniform.
    alternatives:
      - PATCH /openings/:id with a status body
    durable: true
    scope: api
    status: proposed
  - decision: Route all database access through the Backend API and add the migration there.
    rationale: Only the Backend API reads and writes the Relational Database.
    alternatives: []
    durable: false
    scope: api
    status: follows
    follows_adr: [ADR-0001, ADR-0002]
  - decision: Close from the web app with a single HR-only button and no confirmation dialog.
    rationale: Keeps the story small; the action is a status change with no data loss. Easy to add a dialog later.
    alternatives:
      - A confirmation dialog like PublishDialog
    durable: false
    scope: web
    status: proposed
estimated_points: 3
package_dependencies: []
notes: |
  ### Data & rollout

  - **Existing data**: migration 002 only replaces the status check constraint with a wider one. Every existing Draft and Published row satisfies it, so nothing is rewritten and all rows stay readable.
  - **Backfill / seed**: none needed.
  - **Settings**: none.
  - **Provisioning**: none; `pnpm` migrate script (src/migrate.ts) applies 002 on deploy.
  - **Order and rollback**: migrate before deploying the new code. Rollback: restore the narrower constraint, but only after any Closed rows are moved back to Published, otherwise the constraint add fails; leaving the wider constraint in place is safe with old code.

  ```mermaid
  flowchart TD
    Web[JobOpeningsPage.tsx] -->|close button| Client[api/openings.ts]
    Client -->|POST /openings/:id/close| Routes[routes/openings.ts]
    Routes --> Repo[repository.ts]
    Repo --> Mem[memoryRepository.ts]
    Repo --> Pg[pgRepository.ts]
    Mem --> Domain[domain.ts]
    Pg --> Mig[002 migration]
    classDef touched fill:#f96,color:#000
    class Web,Client,Routes,Repo,Mem,Pg,Domain,Mig touched
  ```
review_focus: |
  IN: Closed status, HR-only close endpoint, migration, guard refusing Closed, and a small web Close button. OUT: any application entity, public unauthenticated portal and reopening. Riskiest part is the status check constraint migration and the 403-before-repository ordering. AC3 to AC5 are covered through the guard and list endpoint because applications and the public portal do not exist yet; that is deliberate.
