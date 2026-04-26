export function createDomChangeScheduler(
  schedule: () => void,
  root: ParentNode = document.documentElement,
): () => void {
  const observer = new MutationObserver((mutations) => {
    if (mutations.some(shouldScheduleForMutation)) schedule();
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function shouldScheduleForMutation(mutation: MutationRecord): boolean {
  if (isExtensionOwnedNode(mutation.target)) return false;
  return Array.from(mutation.addedNodes).some((node) => !isExtensionOwnedNode(node));
}

function isExtensionOwnedNode(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  return Boolean(node.closest('[data-exp-id]'));
}
