export interface Book {
  id: number;
  title: string;
  author: string;
  year: number;
}

export const books: Book[] = [
  { id: 1, title: "Dune", author: "Frank Herbert", year: 1965 },
  { id: 2, title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", year: 1969 },
  { id: 3, title: "The Dispossessed", author: "Ursula K. Le Guin", year: 1974 },
  { id: 4, title: "Hyperion", author: "Dan Simmons", year: 1989 },
  { id: 5, title: "Dune Messiah", author: "Frank Herbert", year: 1969 },
  { id: 6, title: "Neuromancer", author: "William Gibson", year: 1984 },
];
