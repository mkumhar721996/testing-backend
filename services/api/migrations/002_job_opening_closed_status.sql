alter table job_openings drop constraint job_openings_status_check;
alter table job_openings add constraint job_openings_status_check
  check (status in ('Draft', 'Published', 'Closed'));
