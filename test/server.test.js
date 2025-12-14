const request = require('supertest');
const { app, ShoppingList } = require('../server');

const mockUserId = "user123";
const mockListId = "list123";
const mockList = {
  _id: mockListId,
  name: "Test List",
  ownerId: mockUserId,
  members: [mockUserId],
  items: [],
  archived: false,
  save: jest.fn().mockResolvedValue(true)
};

describe('Shopping List API Unit Tests', () => {

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /list/list', () => {
    it('Happy Day: Should return a list of shopping lists for the user', async () => {
      jest.spyOn(ShoppingList, 'find').mockResolvedValue([mockList]);

      const res = await request(app)
        .get('/list/list')
        .set('x-user-id', mockUserId);

      expect(res.statusCode).toEqual(200);
      expect(res.body.lists).toHaveLength(1);
      expect(res.body.lists[0].name).toEqual("Test List");
    });

    it('Alternative: Should handle database errors', async () => {
      jest.spyOn(ShoppingList, 'find').mockRejectedValue(new Error('DB Error'));

      const res = await request(app)
        .get('/list/list')
        .set('x-user-id', mockUserId);

      expect(res.statusCode).toEqual(500);
      expect(res.body.uuAppErrorMap['list/list/sys']).toBeDefined();
    });
  });

  describe('GET /list/get', () => {
    it('Happy Day: Should return a single list by ID', async () => {
      jest.spyOn(ShoppingList, 'findById').mockResolvedValue(mockList);

      const res = await request(app)
        .get(`/list/get?id=${mockListId}`)
        .set('x-user-id', mockUserId);

      expect(res.statusCode).toEqual(200);
      expect(res.body.id).toEqual(mockListId);
    });

    it('Alternative: Should return 400 if ID is missing', async () => {
      const res = await request(app)
        .get('/list/get')
        .set('x-user-id', mockUserId);

      expect(res.statusCode).toEqual(400);
      expect(res.body.uuAppErrorMap['list/get/invalidDtoIn']).toBeDefined();
    });

    it('Alternative: Should return 400 if list not found or access denied', async () => {
      jest.spyOn(ShoppingList, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .get(`/list/get?id=${mockListId}`)
        .set('x-user-id', mockUserId);

      expect(res.statusCode).toEqual(400);
      expect(res.body.uuAppErrorMap['list/get/notAuthorized']).toBeDefined();
    });
  });

  describe('POST /list/create', () => {
    it('Happy Day: Should create a new list', async () => {
      jest.spyOn(ShoppingList, 'create').mockResolvedValue(mockList);

      const res = await request(app)
        .post('/list/create')
        .set('x-user-id', mockUserId)
        .send({ name: "New List" });

      expect(res.statusCode).toEqual(200);
      expect(res.body.name).toEqual("Test List");
    });

    it('Alternative: Should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/list/create')
        .set('x-user-id', mockUserId)
        .send({});

      expect(res.statusCode).toEqual(400);
      expect(res.body.uuAppErrorMap['list/create/invalidDtoIn']).toBeDefined();
    });
  });

  describe('POST /list/update', () => {
    it('Happy Day: Should update list name', async () => {
      jest.spyOn(ShoppingList, 'findById').mockResolvedValue(mockList);

      const res = await request(app)
        .post('/list/update')
        .set('x-user-id', mockUserId)
        .send({ id: mockListId, name: "Updated Name" });

      expect(res.statusCode).toEqual(200);
      expect(mockList.name).toEqual("Updated Name");
    });

    it('Alternative: Should return 404 if list not found', async () => {
      jest.spyOn(ShoppingList, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .post('/list/update')
        .set('x-user-id', mockUserId)
        .send({ id: "wrongId", name: "New Name" });

      expect(res.statusCode).toEqual(404);
      expect(res.body.uuAppErrorMap['list/update/notFound']).toBeDefined();
    });

    it('Alternative: Should return 403 if not owner', async () => {
      const otherUserList = { ...mockList, ownerId: "otherUser" };
      jest.spyOn(ShoppingList, 'findById').mockResolvedValue(otherUserList);

      const res = await request(app)
        .post('/list/update')
        .set('x-user-id', mockUserId)
        .send({ id: mockListId, name: "New Name" });

      expect(res.statusCode).toEqual(403);
      expect(res.body.uuAppErrorMap['list/update/notAuthorized']).toBeDefined();
    });
  });

  describe('POST /list/delete', () => {
    it('Happy Day: Should delete a list', async () => {
      jest.spyOn(ShoppingList, 'findById').mockResolvedValue(mockList);
      jest.spyOn(ShoppingList, 'findByIdAndDelete').mockResolvedValue(mockList);

      const res = await request(app)
        .post('/list/delete')
        .set('x-user-id', mockUserId)
        .send({ id: mockListId });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });

    it('Alternative: Should return 404 if list not found', async () => {
      jest.spyOn(ShoppingList, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .post('/list/delete')
        .set('x-user-id', mockUserId)
        .send({ id: "wrongId" });

      expect(res.statusCode).toEqual(404);
    });

    it('Alternative: Should return 403 if not owner', async () => {
      const otherUserList = { ...mockList, ownerId: "otherUser" };
      jest.spyOn(ShoppingList, 'findById').mockResolvedValue(otherUserList);

      const res = await request(app)
        .post('/list/delete')
        .set('x-user-id', mockUserId)
        .send({ id: mockListId });

      expect(res.statusCode).toEqual(403);
    });
  });

});