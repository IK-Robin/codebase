import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
// import your route components too
import App from './App';
import './style/index.scss';
const root = ReactDOM.createRoot(
  document.getElementById("root")
);

root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />}>
        {/* <Route index element={<Home />} /> */}
       
      </Route>
    </Routes>
  </BrowserRouter>
);
