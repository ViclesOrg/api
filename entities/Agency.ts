export default class Agency
{
    id: Number
    name: String
    comercialRegister: String
    email: String
    phone: String
    password: String
    address: String
    image: String
    banner: String

    constructor(id: Number, name: String, comercialRegister: String, email: String, password: String, address: String, phone: String, image: String, banner: String)
    {
        this.id = id
        this.name = name;
        this.comercialRegister = comercialRegister;
        this.email = email;
        this.phone = phone;
        this.password = password;
        this.address = address;
        this.image = image;
        this.banner = banner;
    }
}