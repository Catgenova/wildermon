/*
 * The doors locked on what the two migrations before the definitions
 * (`20261101100002_defs.sql`) brought in: a definitions migration does not
 * lock them.
 */
select private.lock_doors();
