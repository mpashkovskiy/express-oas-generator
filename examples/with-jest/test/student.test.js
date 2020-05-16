const { supertest } = require("./supertest");

describe("/student API", () => {
	it("should return a valid student", async () => {
		try {
			const res = await supertest.get("/api/v1/student");

			expect(res.status).toBe(200);

			expect(res.body).toHaveProperty("student");
			expect(res.body.student).toHaveProperty("id");
			expect(res.body.student).toHaveProperty("name");
		} finally {
			//
		}
	});

	/**
	 * add as many tests as you'd like
	 */

	/**
	 * Lastly - we need a work-around - create one last test & make a request.
	 * See https://github.com/mpashkovskiy/express-oas-generator/issues/50
	 */
	it("workaround", async () => {
		await supertest.get(`/api/v1`);
	})
});
