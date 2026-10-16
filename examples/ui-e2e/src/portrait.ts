/** A portrait drawn inline (TASK-374): an image that loads without a file or a request. */
export const portrait = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" fill="#c7d2fe"/>
    <circle cx="40" cy="31" r="14" fill="#4338ca"/>
    <path d="M12 80a28 28 0 0 1 56 0z" fill="#4338ca"/>
  </svg>`,
)}`;
