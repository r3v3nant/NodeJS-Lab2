const { ApolloServer, gql } = require("apollo-server-lambda");
const connectDB = require("./db");
const { ObjectId } = require("mongodb");

// 1. ќпис схеми даних (GraphQL Schema)
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

// 2. –езолвери дл€ роботи з MongoDB (Resolvers)
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

// 3. ≤н≥ц≥ал≥зац≥€ сервера Apollo ƒЋя NETLIFY (Ѕ≈« express та serverless-http)
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ event, context }) => ({ event, context }),
});

// ≈кспортуЇмо чистий вбудований хендлер apollo-server-lambda
exports.handler = server.createHandler();