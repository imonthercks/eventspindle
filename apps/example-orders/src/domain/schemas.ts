import orderPlaced from './schemas/order-placed.v1.json' with { type: 'json' };
import fulfillmentRequested from './schemas/fulfillment-requested.v1.json' with { type: 'json' };
import shipmentConfirmed from './schemas/shipment-confirmed.v1.json' with { type: 'json' };
import { createPayloadSchemaRegistry } from '@eventspindle/core';

export const orderSchemaRegistry = createPayloadSchemaRegistry([
  {
    type: 'org.eventspindle.sales.OrderPlaced',
    version: 1,
    uri: orderPlaced.$id,
    integrity: 'sha256:a5048043143bf687db656845cee5381d0f5a6685313cfe14612bc6458cf2f622',
    schema: orderPlaced,
  },
  {
    type: 'org.eventspindle.sales.FulfillmentRequested',
    version: 1,
    uri: fulfillmentRequested.$id,
    integrity: 'sha256:1150ba1eaace13cc8e96dc638c3f7219478a7ac927ece439cfdc2d3fe8c98e3f',
    schema: fulfillmentRequested,
  },
  {
    type: 'org.eventspindle.sales.ShipmentConfirmed',
    version: 1,
    uri: shipmentConfirmed.$id,
    integrity: 'sha256:51a99ee54924352e26741ddcb4e50a2c24ac107610919ca4cce36afa7e7949cf',
    schema: shipmentConfirmed,
  },
]);
