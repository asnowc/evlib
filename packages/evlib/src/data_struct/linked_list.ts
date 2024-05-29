/** @public */
export type SinglyLinkList<T extends object = {}> = T & {
  next?: SinglyLinkList<T>;
};
/** @public */
export type DoublyLinkList<T extends object = {}> = {
  before?: DoublyLinkList<T>;
  next?: DoublyLinkList<T>;
};

/**
 * 遍历链表的迭代器
 * @public */
export function* eachLinkedList<T extends object>(link?: SinglyLinkList<T>) {
  while (link) {
    yield link;
    link = link.next;
  }
}
/**
 * 向后查找指定长度的链节点
 * @public
 */
export function getLinkedListByIndex<T extends object>(
  link: SinglyLinkList<T>,
  index: number
) {
  for (let i = 0; i < index; i++) {
    if (!link.next) throw new RangeError("Over range of the linked list");
    link = link.next;
  }
  if (!link || index < 0) throw new RangeError("Over range of the linked list");

  return link;
}
