/** Nota de 0 a 5. */
export class Avaliacao {
  constructor(
    readonly nota: number,
    readonly comentario: string,
    readonly data: Date,
  ) {}
}
