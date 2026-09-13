import type { RevisionSheet } from "./types";

/**
 * Shown at rest so the app never opens as an empty shell, and used for the
 * worked examples on the landing page. Real Operating Systems content.
 */
export const SAMPLE_SHEET: RevisionSheet = {
    subject: "Operating Systems",
    title: "Deadlock: conditions, handling, and the banker's algorithm",
    overview: "A deadlock is a set of processes each holding one resource and waiting for another held by someone else in the same set, so none can ever proceed. This sheet covers the four conditions that must hold together, the four strategies for dealing with them, and how safe-state checking actually runs.",
    concepts: [
      { term: "Deadlock", definition: "A permanent blocking of a set of processes, where every process waits on an event only another process in that same set can cause." },
      { term: "Hold and wait", definition: "A process holds at least one resource while waiting to acquire additional resources held by others." },
      { term: "No preemption", definition: "A resource cannot be forcibly taken from a process. It is released only voluntarily." },
      { term: "Circular wait", definition: "A closed chain of processes exists, where each holds a resource the next one is waiting for." },
      { term: "Safe state", definition: "A state in which some ordering of processes exists such that each can obtain its maximum need, run, and release. A safe state is never deadlocked." }
    ],
    sections: [
      { heading: "The four Coffman conditions", points: [
        "All four must hold simultaneously for deadlock to be possible. Break any one and deadlock cannot occur.",
        "Mutual exclusion and no preemption are usually properties of the resource, so they are hard to remove without breaking correctness.",
        "Hold and wait can be broken by requiring every resource up front, at the cost of poor utilisation.",
        "Circular wait is broken by imposing a total ordering on resource types and requiring requests in increasing order."
      ]},
      { heading: "Four ways to handle deadlock", points: [
        "Prevention: structurally deny one of the four conditions, decided at design time.",
        "Avoidance: check each request against future need and grant only if the system stays in a safe state.",
        "Detection and recovery: let it happen, run a pass over the wait-for graph, then abort or preempt.",
        "The ostrich approach: ignore it, which is what most general-purpose systems actually do."
      ]},
      { heading: "Banker's algorithm, step by step", points: [
        "Inputs are Available, Max, Allocation, and Need, where Need equals Max minus Allocation.",
        "On a request, check it does not exceed Need, then that it does not exceed Available.",
        "Pretend to grant it, then look for any process whose Need fits inside Work, run it, and add its Allocation back.",
        "If every process can be marked finished, the sequence is safe and the request is granted. Otherwise roll back."
      ]},
      { heading: "Detection, and why it differs", points: [
        "With one instance per resource type, a cycle in the wait-for graph is a deadlock.",
        "With multiple instances, a cycle is necessary but not sufficient, so the marking pass has to run.",
        "Detection frequency is a trade-off between constant overhead and losing track of which process caused it."
      ]}
    ],
    memorize: [
      "Four Coffman conditions: mutual exclusion, hold and wait, no preemption, circular wait.",
      "Need = Max - Allocation.",
      "Safe implies no deadlock. Unsafe does not imply deadlock, only the possibility of it.",
      "One instance per type: a cycle means deadlock. Multiple instances: a cycle is necessary, not sufficient."
    ],
    traps: [
      "Writing that a cycle in the resource-allocation graph always means deadlock. That only holds with exactly one instance per type.",
      "Treating unsafe and deadlocked as the same thing. An unsafe state may still finish if processes ask for less than their maximum.",
      "Forgetting that the banker's algorithm needs each process to declare its maximum demand in advance."
    ],
    quiz: [
      { question: "Which condition is most commonly removed in practice by imposing a global ordering on resource types?",
        options: ["Mutual exclusion", "Hold and wait", "No preemption", "Circular wait"],
        answerIndex: 3, tests: "The four Coffman conditions",
        explanation: "A total ordering forces requests in increasing order, which makes a closed chain impossible. The other three are properties of the resource or too costly to remove." },
      { question: "A system is in an unsafe state. What follows?",
        options: ["It is deadlocked right now", "It will certainly deadlock later", "Deadlock is possible but not guaranteed", "A process has already been aborted"],
        answerIndex: 2, tests: "Detection, and why it differs",
        explanation: "Unsafe means no safe sequence is guaranteed. If processes ask for less than their declared maximum, execution can still finish. Safe implies no deadlock, unsafe implies only risk." },
      { question: "In the banker's algorithm, what is checked first when a process issues a request?",
        options: ["Whether granting it leaves a safe state", "Whether the request exceeds remaining Need", "Whether another process is blocked", "Whether the wait-for graph has a cycle"],
        answerIndex: 1, tests: "Banker's algorithm, step by step",
        explanation: "Need is validated first, since asking for more than the declared maximum is an error rather than a scheduling decision. Safety is checked only after Need and Available both pass." },
      { question: "With multiple instances of each resource type, a cycle in the resource-allocation graph means:",
        options: ["Deadlock has definitely occurred", "Deadlock may have occurred, so a detection pass is needed", "The system is in a safe state", "No deadlock is possible"],
        answerIndex: 1, tests: "Detection, and why it differs",
        explanation: "Another process holding a spare instance can still release it and break the chain. The cycle is necessary but not sufficient, so the marking pass decides." },
      { question: "Which handling strategy do most general-purpose operating systems actually use?",
        options: ["Prevention by denying hold and wait", "Avoidance using the banker's algorithm", "Periodic detection with termination", "Ignoring the problem entirely"],
        answerIndex: 3, tests: "Four ways to handle deadlock",
        explanation: "The ostrich approach is standard in Linux and Windows. Deadlocks are rare, and forcing every process to declare maximum demand in advance costs more than the occasional restart." }
    ]
  };
