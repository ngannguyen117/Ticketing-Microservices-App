import {
  Subjects,
  Listener,
  ExpirationCompleteEvent,
  NotFoundError,
} from '@2ntickets/common';
import { Message } from 'node-nats-streaming';
import { queueGroupName } from './queue-group-names';
import { Order, OrderStatus } from '../../models';
import { OrderCancelledPublisher } from '../publishers';

export class ExpirationCompleteListener extends Listener<
  ExpirationCompleteEvent
> {
  subject: Subjects.ExpirationComplete = Subjects.ExpirationComplete;
  queueGroupName = queueGroupName;

  async onMessage(data: ExpirationCompleteEvent['data'], msg: Message) {
    const order = await Order.findById(data.orderId).populate('ticket');
    if (!order) throw new NotFoundError();

    if (order.status !== OrderStatus.Completed) {
      order.set({ status: OrderStatus.Cancelled });
      await order.save();
      await new OrderCancelledPublisher(this.client).publish({
        id: order.id,
        version: order.version,
        ticket: { id: order.ticket.id },
      });
    }

    msg.ack();
  }
}
