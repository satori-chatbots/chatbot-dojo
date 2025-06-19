import React, { useState } from "react";
import { Button, Input, Card, Form, Spinner } from "@heroui/react";
import { Link, useNavigate } from "react-router-dom";
import { EyeFilledIcon, EyeSlashFilledIcon } from "./login-view";
import { submitSignUp } from "../api/authentication-api";
import { useAuth } from "../contexts/auth-context";

function SignupView() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const toggleVisibility = () => setIsVisible(!isVisible);
  const toggleConfirmVisibility = () => setIsConfirmVisible(!isConfirmVisible);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const response = await submitSignUp({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        password: formData.password,
      });
      login(response);
      setLoading(false);
      navigate("/");
    } catch (error_) {
      setError(error_.message);
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    setFormData((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 w-full">
      <Card className="p-6 sm:p-8 w-full max-w-md space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-center">
          Create Account
        </h1>
        <Form
          className="flex flex-col space-y-8"
          onSubmit={handleSubmit}
          validationBehavior="native"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              label="First Name"
              name="firstName"
              placeholder="Enter your first name"
              value={formData.firstName}
              onChange={handleChange}
              isRequired
              fullWidth
            />
            <Input
              label="Last Name"
              name="lastName"
              placeholder="Enter your last name"
              value={formData.lastName}
              onChange={handleChange}
              isRequired
              fullWidth
              labelPlacement="outside"
            />
          </div>
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            isRequired
            fullWidth
            labelPlacement="outside"
          />
          <Input
            label="Password"
            name="password"
            endContent={
              <button
                className="focus:outline-none"
                type="button"
                onClick={toggleVisibility}
              >
                {isVisible ? (
                  <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                ) : (
                  <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                )}
              </button>
            }
            type={isVisible ? "text" : "password"}
            placeholder="Create a password"
            value={formData.password}
            onChange={handleChange}
            isRequired
            fullWidth
            labelPlacement="outside"
          />
          <Input
            label="Confirm Password"
            name="confirmPassword"
            endContent={
              <button
                className="focus:outline-none"
                type="button"
                onClick={toggleConfirmVisibility}
              >
                {isConfirmVisible ? (
                  <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                ) : (
                  <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                )}
              </button>
            }
            type={isConfirmVisible ? "text" : "password"}
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={handleChange}
            isRequired
            fullWidth
            labelPlacement="outside"
          />
          {error && <p className="text-danger text-sm text-center">{error}</p>}
          <Button
            type="submit"
            color="primary"
            fullWidth
            size="lg"
            isLoading={loading}
          >
            {loading ? <Spinner size="sm" /> : "Sign Up"}
          </Button>
        </Form>
        <div className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link to="/login" className="text-primary-500">
            Log in
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default SignupView;
