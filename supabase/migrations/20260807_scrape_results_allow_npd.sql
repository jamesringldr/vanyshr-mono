-- Allow NPD as scrape_results.target (residential service :8789)
ALTER TABLE scrape_results
  DROP CONSTRAINT IF EXISTS scrape_results_target_check;

ALTER TABLE scrape_results
  ADD CONSTRAINT scrape_results_target_check
  CHECK (target IN ('fps', 'anywho', 'zabasearch', 'npd'));

-- Keep scrape_type 'both' allowed (ops fix from earlier sessions)
ALTER TABLE scrape_results
  DROP CONSTRAINT IF EXISTS scrape_results_type_check;

ALTER TABLE scrape_results
  ADD CONSTRAINT scrape_results_type_check
  CHECK (scrape_type IN ('summary', 'full', 'both'));
