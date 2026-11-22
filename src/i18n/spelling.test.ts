import { describe, expect, it } from 'vitest'
import { translations } from './translations'

// Words that used to appear without their accents in es/fr (see issue #30).
const broken: Record<'es' | 'fr', RegExp> = {
  es: /\b(Senal(es)?|SENAL(ES)?|senal(es)?|diseno|Todavia|todavia|Introduccion|introduccion|analitica|rapid[ao]s?\b|Ultima|Aun|Reflexion|Patron|Camara|camara|microfono|ubicacion|Conversacion|Observacion|Proteccion|Portatil|menus|Mas tarde|Version)\b/,
  fr: /\b(Reflexions?|reflexions?|Reflechir|concu|memoire|donnees|entrees?|periode|Coordonnees|Etape|Etat|Deuxieme|Troisieme|bibliotheque|sauvegarde[sd]? creee|Telecharge|detail|details|televerse|ignores?|importes|trouves?|apercu|Apres)\b/
}

describe('Rechtschreibung in es/fr', () => {
  it.each(['es', 'fr'] as const)('enthält in %s keine bekannten Schreibweisen ohne Akzente', (code) => {
    const offenders = Object.entries(translations[code])
      .filter(([, value]) => broken[code].test(value))
      .map(([key, value]) => `${key}: ${value}`)

    expect(offenders).toEqual([])
  })
})
