const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testMenuItem = {
    id: 1,
    title: "Veggie",
    image: "pizza1.png",
    price: 0.0038,
    description: "A garden of delight",
};
let testUserAuthToken;

async function createAdminUser() {
    let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + "@admin.com";

    user = await DB.addUser(user);
    return { ...user, password: "toomanysecrets" };
}

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

beforeAll(async () => {
    const adminUser = await createAdminUser();
    const loginRes = await request(app).put("/api/auth").send(adminUser);
    testUserAuthToken = loginRes.body.token;
    expectValidJwt(testUserAuthToken);
});

test("getMenu", async () => {
    const getMenuRes = await request(app).get("/api/order/menu");
    expect(getMenuRes.status).toBe(200);

    expect(getMenuRes.body).toEqual(expect.any(Array));
});

test("addMenuItem", async () => {
    const newMenuItem = {
        title: "Student",
        description: "No topping, no sauce, just carbs",
        image: "pizza9.png",
        price: 0.0001,
    };
    const addMenuRes = await request(app)
        .put("/api/order/menu")
        .set("Authorization", `Bearer ${testUserAuthToken}`)
        .send(newMenuItem);
    expect(addMenuRes.status).toBe(200);

    const addedItem = { ...addMenuRes.body[addMenuRes.body.length - 1] };
    delete addedItem.id;
    expect(addedItem).toEqual(newMenuItem);
});

function expectValidJwt(potentialJwt) {
    expect(potentialJwt).toMatch(
        /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/
    );
}
