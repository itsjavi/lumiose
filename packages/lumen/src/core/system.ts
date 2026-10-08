/**
 * The push-pull reactive graph algorithm, vendored from alien-signals v3.2.1
 * (https://github.com/stackblitz/alien-signals, src/system.ts).
 *
 * Copyright (c) 2024-present Johnson Chu. Released under the MIT License;
 * the full text is in ./LICENSE.alien-signals.
 *
 * Changes from upstream: the `ReactiveFlags` const enum became plain constants
 * (Lumen compiles with `erasableSyntaxOnly`), and comments were added. The
 * algorithm itself is unchanged: intrusive doubly-linked `Link` edges, link reuse
 * through the `depsTail` cursor, flags instead of collections, and iterative
 * traversal with explicit stacks instead of recursion.
 */
// The code mirrors upstream line by line, so these style rules are not applied to it.
/* eslint-disable no-constant-condition, no-shadow, unicorn/consistent-function-scoping */

export interface ReactiveNode {
  deps?: Link | undefined;
  depsTail?: Link | undefined;
  subs?: Link | undefined;
  subsTail?: Link | undefined;
  flags: number;
}

/** One dependency edge. It sits in the subscriber's `deps` list and in the dependency's `subs` list. */
export interface Link {
  version: number;
  dep: ReactiveNode;
  sub: ReactiveNode;
  prevSub: Link | undefined;
  nextSub: Link | undefined;
  prevDep: Link | undefined;
  nextDep: Link | undefined;
}

interface Stack<T> {
  value: T;
  prev: Stack<T> | undefined;
}

/** The node can be re-evaluated (signals, computeds, triggers). */
export const MUTABLE = 1;
/** The node is a sink that gets scheduled when its dependencies change (effects). */
export const WATCHING = 2;
/** The node is currently tracking its dependencies. */
export const RECURSED_CHECK = 4;
/** The node received a change while tracking; propagate through it again later. */
export const RECURSED = 8;
/** The node is known to be stale. */
export const DIRTY = 16;
/** The node may be stale: one of its dependencies may have changed. */
export const PENDING = 32;

export interface ReactiveSystem {
  link(dep: ReactiveNode, sub: ReactiveNode, version: number): void;
  unlink(link: Link, sub?: ReactiveNode): Link | undefined;
  propagate(link: Link, innerWrite: boolean): void;
  checkDirty(link: Link, sub: ReactiveNode): boolean;
  shallowPropagate(link: Link): void;
}

export function createReactiveSystem({
  update,
  notify,
  unwatched,
}: {
  /** Re-evaluates a mutable node and reports whether its value changed. */
  update(node: ReactiveNode): boolean;
  /** Schedules a watching node. */
  notify(node: ReactiveNode): void;
  /** Called when a node loses its last subscriber. */
  unwatched(node: ReactiveNode): void;
}): ReactiveSystem {
  return { link, unlink, propagate, checkDirty, shallowPropagate };

  function link(dep: ReactiveNode, sub: ReactiveNode, version: number): void {
    const prevDep = sub.depsTail;
    if (prevDep !== undefined && prevDep.dep === dep) {
      return;
    }
    const nextDep = prevDep !== undefined ? prevDep.nextDep : sub.deps;
    if (nextDep !== undefined && nextDep.dep === dep) {
      nextDep.version = version;
      sub.depsTail = nextDep;
      return;
    }
    const prevSub = dep.subsTail;
    if (prevSub !== undefined && prevSub.version === version && prevSub.sub === sub) {
      return;
    }
    const newLink: Link =
      (sub.depsTail =
      dep.subsTail =
        {
          version,
          dep,
          sub,
          prevDep,
          nextDep,
          prevSub,
          nextSub: undefined,
        });
    if (nextDep !== undefined) {
      nextDep.prevDep = newLink;
    }
    if (prevDep !== undefined) {
      prevDep.nextDep = newLink;
    } else {
      sub.deps = newLink;
    }
    if (prevSub !== undefined) {
      prevSub.nextSub = newLink;
    } else {
      dep.subs = newLink;
    }
  }

  function unlink(link: Link, sub = link.sub): Link | undefined {
    const { dep, prevDep, nextDep, nextSub, prevSub } = link;
    if (nextDep !== undefined) {
      nextDep.prevDep = prevDep;
    } else {
      sub.depsTail = prevDep;
    }
    if (prevDep !== undefined) {
      prevDep.nextDep = nextDep;
    } else {
      sub.deps = nextDep;
    }
    if (nextSub !== undefined) {
      nextSub.prevSub = prevSub;
    } else {
      dep.subsTail = prevSub;
    }
    if (prevSub !== undefined) {
      prevSub.nextSub = nextSub;
    } else if ((dep.subs = nextSub) === undefined) {
      unwatched(dep);
    }
    return nextDep;
  }

  function propagate(link: Link, innerWrite: boolean): void {
    let next = link.nextSub;
    let stack: Stack<Link | undefined> | undefined;

    top: do {
      const sub = link.sub;
      let flags = sub.flags;

      if (!(flags & (RECURSED_CHECK | RECURSED | DIRTY | PENDING))) {
        sub.flags = flags | PENDING;
        if (innerWrite) {
          sub.flags |= RECURSED;
        }
      } else if (!(flags & (RECURSED_CHECK | RECURSED))) {
        flags = 0;
      } else if (!(flags & RECURSED_CHECK)) {
        sub.flags = (flags & ~RECURSED) | PENDING;
      } else if (!(flags & (DIRTY | PENDING)) && isValidLink(link, sub)) {
        sub.flags = flags | (RECURSED | PENDING);
        flags &= MUTABLE;
      } else {
        flags = 0;
      }

      if (flags & WATCHING) {
        notify(sub);
      }

      if (flags & MUTABLE) {
        const subSubs = sub.subs;
        if (subSubs !== undefined) {
          const nextSub = (link = subSubs).nextSub;
          if (nextSub !== undefined) {
            stack = { value: next, prev: stack };
            next = nextSub;
          }
          continue;
        }
      }

      if ((link = next!) !== undefined) {
        next = link.nextSub;
        continue;
      }

      while (stack !== undefined) {
        link = stack.value!;
        stack = stack.prev;
        if (link !== undefined) {
          next = link.nextSub;
          continue top;
        }
      }

      break;
    } while (true);
  }

  function checkDirty(link: Link, sub: ReactiveNode): boolean {
    let stack: Stack<Link> | undefined;
    let checkDepth = 0;
    let dirty = false;

    top: do {
      const dep = link.dep;
      const flags = dep.flags;

      if (sub.flags & DIRTY) {
        dirty = true;
      } else if ((flags & (MUTABLE | DIRTY)) === (MUTABLE | DIRTY)) {
        const subs = dep.subs!;
        if (update(dep)) {
          if (subs.nextSub !== undefined) {
            shallowPropagate(subs);
          }
          dirty = true;
        }
      } else if ((flags & (MUTABLE | PENDING)) === (MUTABLE | PENDING)) {
        stack = { value: link, prev: stack };
        link = dep.deps!;
        sub = dep;
        ++checkDepth;
        continue;
      }

      if (!dirty) {
        const nextDep = link.nextDep;
        if (nextDep !== undefined) {
          link = nextDep;
          continue;
        }
      }

      while (checkDepth--) {
        link = stack!.value;
        stack = stack!.prev;
        if (dirty) {
          const subs = sub.subs!;
          if (update(sub)) {
            if (subs.nextSub !== undefined) {
              shallowPropagate(subs);
            }
            sub = link.sub;
            continue;
          }
          dirty = false;
        } else {
          sub.flags &= ~PENDING;
        }
        sub = link.sub;
        const nextDep = link.nextDep;
        if (nextDep !== undefined) {
          link = nextDep;
          continue top;
        }
      }

      return dirty && !!sub.flags;
    } while (true);
  }

  function shallowPropagate(link: Link): void {
    do {
      const sub = link.sub;
      const flags = sub.flags;
      if ((flags & (PENDING | DIRTY)) === PENDING) {
        sub.flags = flags | DIRTY;
        if ((flags & (WATCHING | RECURSED_CHECK)) === WATCHING) {
          notify(sub);
        }
      }
    } while ((link = link.nextSub!) !== undefined);
  }

  function isValidLink(checkLink: Link, sub: ReactiveNode): boolean {
    let link = sub.depsTail;
    while (link !== undefined) {
      if (link === checkLink) {
        return true;
      }
      link = link.prevDep;
    }
    return false;
  }
}
