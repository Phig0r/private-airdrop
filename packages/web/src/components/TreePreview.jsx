export default function TreePreview({ count, built }) {
  return (
    <svg
      className={`mini-tree ${built ? "built" : ""}`}
      viewBox="0 0 140 84"
      role="img"
      aria-label={`Merkle tree overview: ${count} participants, 8 levels, 256 leaf capacity`}
    >
      <g fill="none" stroke="currentColor">
        <path d="M70 21 V35 H32 V49 M70 35 H108 V49 M32 55 V65 H16 V75 M32 65 H48 V75 M108 55 V65 H92 V75 M108 65 H124 V75" />
      </g>
      <g fill="currentColor">
        {[
          [70, 15, 7],
          [32, 52, 5],
          [108, 52, 5],
          [16, 77, 3],
          [48, 77, 3],
          [92, 77, 3],
          [124, 77, 3],
        ].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
    </svg>
  );
}
