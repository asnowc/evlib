/** @public */
export type SinglyLinkList = {
  next?: SinglyLinkList;
};
/** @public */
export type DoublyLinkList = {
  before?: DoublyLinkList;
  next?: DoublyLinkList;
};

/**
 * 遍历链表的迭代器
 * @public */
export function* eachLinkedList<T extends SinglyLinkList>(link?: T) {
  while (link) {
    yield link;
    link = link.next as T | undefined;
  }
}
/**
 * 向后查找指定长度的链节点
 * @public
 */
export function getLinkedListByIndex<T extends SinglyLinkList>(
  link: T,
  index: number
) {
  for (let i = 0; i < index; i++) {
    if (!link.next) throw new RangeError("Over range of the linked list");
    link = link.next as T;
  }
  if (!link || index < 0) throw new RangeError("Over range of the linked list");

  return link;
}
