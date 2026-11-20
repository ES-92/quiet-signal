// Runs once in the main process before the test workers start; the workers inherit the time zone.
export default function setup() {
  process.env.TZ = 'Europe/Berlin'
}
