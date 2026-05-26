global.crypto = require('crypto'); // Фікс для криптографії

const { ApolloServer, gql } = require("apollo-server-lambda");
const connectDB = require("./db");
const { ObjectId } = require("mongodb");

// 1. Опис схеми даних (GraphQL Schema)
const typeDefs = gql`
  type Task {
    _id: ID!
    title: String!
    completed: Boolean!
  }

  type Query {
    items(filter: String, skip: Int, take: Int, sortField: String, sortOrder: String): [Task]
    item(id: ID!): Task
  }

  type Mutation {
    createItem(title: String!): Task
    updateItem(id: ID!, title: String, completed: Boolean): Task
    deleteItem(id: ID!): Boolean
  }
`;

// 2. Резолвери для роботи з MongoDB (Resolvers)
const resolvers = {
  Query: {
    items: async (_, { filter, skip = 0, take = 10, sortField = "title", sortOrder = "asc" }) => {
      const collection = await connectDB();
      const query = filter ? { title: new RegExp(filter, "i") } : {};
      const sort = sortField ? { [sortField]: sortOrder === "desc" ? -1 : 1 } : {};
      
      return await collection
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(take)
        .toArray();
    },
    item: async (_, { id }) => {
      const collection = await connectDB();
      return await collection.findOne({ _id: new ObjectId(id) });
    },
  },

  Mutation: {
    createItem: async (_, { title }) => {
      const collection = await connectDB();
      const newTask = { title, completed: false, createdAt: new Date() };
      const result = await collection.insertOne(newTask);
      return { _id: result.insertedId, title, completed: false };
    },
    updateItem: async (_, { id, title, completed }) => {
      const collection = await connectDB();
      const updateFields = {};
      if (title !== undefined) updateFields.title = title;
      if (completed !== undefined) updateFields.completed = completed;

      await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
      return { _id: id, ...updateFields };
    },
    deleteItem: async (_, { id }) => {
      const collection = await connectDB();
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    },
  },
};

// 3. Ініціалізація та обхід багу сумісності Netlify / API Gateway
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ event, context }) => ({ event, context }),
});

const apolloHandler = server.createHandler();

// Фікс: Примусово імітуємо структуру AWS API Gateway для обходу помилки 500
exports.handler = (event, context, callback) => {
  if (!event.requestContext) {
    event.requestContext = { elbv2: { targetGroupArn: "netlify" } };
  }
  return apolloHandler(event, context, callback);
};
