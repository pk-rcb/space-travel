import pika

connection = pika.BlockingConnection(pika.ConnectionParameters(localhost))
channel = connection.channel()
channel.queue_declare(queue=booking_queue)
channel.basic_publish(exchange=",
