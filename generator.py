"""KenKen puzzle generator and solver.

Builds an NxN KenKen by generating a random Latin square (the hidden
solution), partitioning the grid into cages, assigning an arithmetic
clue to each cage, and verifying the puzzle has exactly one solution
via a constraint-propagating backtracking solver.
"""

import argparse
import json
import random
from math import prod

OPS = {"+": "+", "-": "−", "*": "×", "/": "÷"}


def random_latin_square(n, rng):
    base = [[(i + j) % n for j in range(n)] for i in range(n)]
    rows = list(range(n))
    cols = list(range(n))
    vals = list(range(n))
    rng.shuffle(rows)
    rng.shuffle(cols)
    rng.shuffle(vals)
    return [[vals[base[rows[r]][cols[c]]] + 1 for c in range(n)] for r in range(n)]


def neighbors(cell, n):
    r, c = cell
    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nr, nc = r + dr, c + dc
        if 0 <= nr < n and 0 <= nc < n:
            yield (nr, nc)


def generate_cages(n, rng):
    if n <= 6:
        sizes, weights, max_singles = [1, 2, 3, 4], [0.08, 0.45, 0.32, 0.15], 2
    else:
        sizes, weights, max_singles = [1, 2, 3, 4, 5], [0.05, 0.40, 0.30, 0.17, 0.08], 3

    unassigned = {(r, c) for r in range(n) for c in range(n)}
    cages = []
    singles_left = max_singles

    while unassigned:
        start = rng.choice(sorted(unassigned))
        pick_sizes, pick_weights = sizes, weights
        if singles_left <= 0:
            pick_sizes = [s for s in sizes if s != 1]
            pick_weights = [w for s, w in zip(sizes, weights) if s != 1]
        target_size = min(rng.choices(pick_sizes, weights=pick_weights)[0], len(unassigned))

        cage = [start]
        unassigned.discard(start)
        frontier = [c for c in neighbors(start, n) if c in unassigned]

        while len(cage) < target_size and frontier:
            nxt = rng.choice(frontier)
            frontier.remove(nxt)
            if nxt not in unassigned:
                continue
            cage.append(nxt)
            unassigned.discard(nxt)
            for nb in neighbors(nxt, n):
                if nb in unassigned and nb not in frontier:
                    frontier.append(nb)

        if len(cage) == 1:
            singles_left -= 1
        cages.append(cage)

    return cages


def assign_clues(cages, solution, rng):
    clues = []
    for cage in cages:
        vals = [solution[r][c] for r, c in cage]
        if len(cage) == 1:
            clues.append({"cells": cage, "op": None, "target": vals[0]})
            continue
        if len(cage) == 2:
            a, b = vals
            options = [("+", a + b), ("-", abs(a - b)), ("*", a * b)]
            lo, hi = min(a, b), max(a, b)
            if hi % lo == 0:
                options.append(("/", hi // lo))
            op, target = rng.choice(options)
        else:
            op = rng.choices(["+", "*"], weights=[0.6, 0.4])[0]
            target = sum(vals) if op == "+" else prod(vals)
        clues.append({"cells": cage, "op": op, "target": target})
    return clues


class StopSearch(Exception):
    pass


def count_solutions(n, clues, limit=2):
    cage_of = {}
    for gi, clue in enumerate(clues):
        for cell in clue["cells"]:
            cage_of[cell] = gi

    cage_total = [len(c["cells"]) for c in clues]
    cage_filled = [0] * len(clues)
    cage_sum = [0] * len(clues)
    cage_prod = [1] * len(clues)
    cage_vals = [[] for _ in clues]

    grid = [[0] * n for _ in range(n)]
    row_used = [0] * n
    col_used = [0] * n
    found = 0

    def cage_ok_partial(gi):
        clue = clues[gi]
        op, target = clue["op"], clue["target"]
        filled, total = cage_filled[gi], cage_total[gi]
        if total == 1:
            return cage_vals[gi][0] == target
        if total == 2:
            if filled < 2:
                return True
            a, b = cage_vals[gi]
            if op == "+":
                return a + b == target
            if op == "-":
                return abs(a - b) == target
            if op == "*":
                return a * b == target
            if op == "/":
                lo, hi = min(a, b), max(a, b)
                return lo != 0 and hi % lo == 0 and hi // lo == target
        if op == "+":
            if filled == total:
                return cage_sum[gi] == target
            return cage_sum[gi] < target
        if op == "*":
            if filled == total:
                return cage_prod[gi] == target
            return cage_prod[gi] <= target and target % cage_prod[gi] == 0
        return True

    def unfilled_cells():
        for r in range(n):
            for c in range(n):
                if grid[r][c] == 0:
                    yield (r, c)

    def candidates(r, c):
        used = row_used[r] | col_used[c]
        return [v for v in range(1, n + 1) if not (used & (1 << v))]

    def pick_cell():
        best, best_cands = None, None
        for r, c in unfilled_cells():
            cands = candidates(r, c)
            if best is None or len(cands) < len(best_cands):
                best, best_cands = (r, c), cands
                if len(cands) <= 1:
                    break
        return best, best_cands

    def backtrack():
        nonlocal found
        cell, cands = pick_cell()
        if cell is None:
            found += 1
            if found >= limit:
                raise StopSearch()
            return
        r, c = cell

        gi = cage_of[(r, c)]
        for v in cands:
            grid[r][c] = v
            row_used[r] |= 1 << v
            col_used[c] |= 1 << v
            cage_filled[gi] += 1
            cage_sum[gi] += v
            cage_prod[gi] *= v
            cage_vals[gi].append(v)

            if cage_ok_partial(gi):
                backtrack()

            cage_vals[gi].pop()
            cage_prod[gi] //= v
            cage_sum[gi] -= v
            cage_filled[gi] -= 1
            row_used[r] &= ~(1 << v)
            col_used[c] &= ~(1 << v)
            grid[r][c] = 0

    try:
        backtrack()
    except StopSearch:
        pass
    return found


def generate_puzzle(n, rng, max_cage_attempts=60, max_square_attempts=20):
    for _ in range(max_square_attempts):
        solution = random_latin_square(n, rng)
        for _ in range(max_cage_attempts):
            cages = generate_cages(n, rng)
            clues = assign_clues(cages, solution, rng)
            if count_solutions(n, clues, limit=2) == 1:
                return {"size": n, "clues": clues, "solution": solution}
    raise RuntimeError(f"failed to generate a unique {n}x{n} puzzle")


def clue_label(clue):
    if clue["op"] is None:
        return str(clue["target"])
    return f'{clue["target"]}{OPS[clue["op"]]}'


def render_ascii(puzzle):
    n = puzzle["size"]
    cages = puzzle["clues"]
    cage_of = {}
    label_at = {}
    for clue in cages:
        top_left = min(clue["cells"])
        label_at[top_left] = clue_label(clue)
        for cell in clue["cells"]:
            cage_of[cell] = id(clue)

    w = 6
    lines = []
    for r in range(n):
        top = []
        mid = []
        for c in range(n):
            border_above = r == 0 or cage_of[(r, c)] != cage_of[(r - 1, c)]
            top.append(("+" if c == 0 else "") + ("-" * w if border_above else " " * w) + "+")
            label = label_at.get((r, c), "")
            cell_text = label.center(w - 1)
            left_border = "|" if c == 0 or cage_of[(r, c)] != cage_of[(r, c - 1)] else " "
            mid.append((left_border if c > 0 else "|") + cell_text)
        lines.append("".join(top) if r == 0 else lines_top_row(n, cage_of, r, w))
        mid.append("|")
        lines.append("".join(mid))
    lines.append(lines_top_row(n, cage_of, n, w))
    return "\n".join(lines)


def lines_top_row(n, cage_of, r, w):
    parts = ["+"]
    for c in range(n):
        if r == 0 or r == n:
            border = True
        else:
            border = cage_of[(r, c)] != cage_of[(r - 1, c)]
        parts.append(("-" * w if border else " " * w) + "+")
    return "".join(parts)


def main():
    parser = argparse.ArgumentParser(description="Generate KenKen puzzles.")
    parser.add_argument("--sizes", type=int, nargs="+", default=[6, 9])
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--out", default="puzzles")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    for n in args.sizes:
        puzzle = generate_puzzle(n, rng)
        path = f"{args.out}/kenken_{n}x{n}.json"
        with open(path, "w") as f:
            json.dump(puzzle, f, indent=2)
        print(f"=== {n}x{n} ===")
        print(render_ascii(puzzle))
        print(f"saved -> {path}\n")


if __name__ == "__main__":
    main()
