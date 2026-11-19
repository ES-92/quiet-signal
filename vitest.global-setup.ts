// Läuft einmal im Hauptprozess, bevor die Test-Worker starten; diese erben die Zeitzone.
export default function setup() {
  process.env.TZ = 'Europe/Berlin'
}
