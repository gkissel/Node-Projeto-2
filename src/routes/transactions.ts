import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { knex } from '../database'
import { randomUUID } from 'node:crypto'
import { ReadableStreamBYOBRequest } from 'stream/web'
import { chechSessionIdExists } from '../middlewares/check-session-id-exists'

export async function transactionRoutes(app: FastifyInstance) {
  app.get(
    '/',
    {
      preHandler: [chechSessionIdExists],
    },
    async (request, reply) => {
      const { sessionId } = request.cookies
      const transactions = await knex('transactions')
        .where('session_id', sessionId)
        .select()

      return { transactions }
    },
  )

  app.get(
    '/:id',
    {
      preHandler: [chechSessionIdExists],
    },
    async (request) => {
      const { sessionId } = request.cookies
      const getTransactionParmsSchema = z.object({
        id: z.string().uuid(),
      })

      const { id } = getTransactionParmsSchema.parse(request.params)

      const transaction = await knex('transactions')
        .where({
          session_id: sessionId,
          id,
        })
        .first()

      return {
        transaction,
      }
    },
  )

  app.get(
    '/summary',
    {
      preHandler: [chechSessionIdExists],
    },
    async (request) => {
      const { sessionId } = request.cookies
      const summary = await knex('transactions')
        .where({
          session_id: sessionId,
        })
        .sum('amount', { as: 'amount' })
        .first()
      return {
        summary,
      }
    },
  )

  app.post('/', async (request, reply) => {
    const createTransactionBodySchema = z.object({
      title: z.string(),
      category: z.string(),
      amount: z.number(),
      type: z.enum(['income', 'outcome']),
    })

    const { title, amount, type, category } = createTransactionBodySchema.parse(
      request.body,
    )
    let sessionId = request.cookies.sessionId

    if (!sessionId) {
      sessionId = randomUUID()

      reply.cookie('sessionId', sessionId, {
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      })
    }

    await knex('transactions').insert({
      id: randomUUID(),
      title,
      category,
      amount: type === 'income' ? amount : amount * -1,
      session_id: sessionId,
    })
    return reply.status(201).send()
  })
}
