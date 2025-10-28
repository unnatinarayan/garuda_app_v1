--
-- PostgreSQL database dump
--

\restrict dn2tAPjcSRusQmALaagzQXu7Q1fOaQfTw6FMJcGsBfkWQvHtT1mQYHikAzzbfAL

-- Dumped from database version 16.10 (Ubuntu 16.10-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.10 (Ubuntu 16.10-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id integer NOT NULL,
    project_id integer NOT NULL,
    aoi_fk_id integer NOT NULL,
    algo_fk_id integer NOT NULL,
    message jsonb NOT NULL,
    alert_timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public.alerts REPLICA IDENTITY FULL;


--
-- Name: alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;


--
-- Name: algorithm_catalogue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.algorithm_catalogue (
    id integer NOT NULL,
    algo_id text NOT NULL,
    args jsonb,
    description text,
    category text
);


--
-- Name: algorithm_catalogue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.algorithm_catalogue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: algorithm_catalogue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.algorithm_catalogue_id_seq OWNED BY public.algorithm_catalogue.id;


--
-- Name: aoi_algorithm_mapping; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aoi_algorithm_mapping (
    id integer NOT NULL,
    aoi_id integer NOT NULL,
    algo_id integer NOT NULL,
    config_args jsonb
);


--
-- Name: aoi_algorithm_mapping_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.aoi_algorithm_mapping_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: aoi_algorithm_mapping_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.aoi_algorithm_mapping_id_seq OWNED BY public.aoi_algorithm_mapping.id;


--
-- Name: area_of_interest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.area_of_interest (
    id integer NOT NULL,
    project_id integer NOT NULL,
    aoi_id text NOT NULL,
    name text NOT NULL,
    geom public.geometry(Polygon,4326) NOT NULL,
    auxdata jsonb,
    publish_flag boolean DEFAULT true NOT NULL,
    geom_properties jsonb
);


--
-- Name: area_of_interest_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.area_of_interest_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: area_of_interest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.area_of_interest_id_seq OWNED BY public.area_of_interest.id;


--
-- Name: project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project (
    id integer NOT NULL,
    project_name text NOT NULL,
    description text,
    creation_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_modified_date timestamp with time zone,
    created_by_userid text NOT NULL,
    auxdata jsonb
);


--
-- Name: project_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_id_seq OWNED BY public.project.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id text NOT NULL,
    username text,
    password_hash text
);


--
-- Name: users_to_project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users_to_project (
    id integer NOT NULL,
    user_id text NOT NULL,
    project_id integer NOT NULL,
    role text NOT NULL
);


--
-- Name: users_to_project_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_to_project_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_to_project_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_to_project_id_seq OWNED BY public.users_to_project.id;


--
-- Name: alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);


--
-- Name: algorithm_catalogue id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.algorithm_catalogue ALTER COLUMN id SET DEFAULT nextval('public.algorithm_catalogue_id_seq'::regclass);


--
-- Name: aoi_algorithm_mapping id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aoi_algorithm_mapping ALTER COLUMN id SET DEFAULT nextval('public.aoi_algorithm_mapping_id_seq'::regclass);


--
-- Name: area_of_interest id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.area_of_interest ALTER COLUMN id SET DEFAULT nextval('public.area_of_interest_id_seq'::regclass);


--
-- Name: project id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project ALTER COLUMN id SET DEFAULT nextval('public.project_id_seq'::regclass);


--
-- Name: users_to_project id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_to_project ALTER COLUMN id SET DEFAULT nextval('public.users_to_project_id_seq'::regclass);


--
-- Name: algorithm_catalogue algorithm_catalogue_algo_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.algorithm_catalogue
    ADD CONSTRAINT algorithm_catalogue_algo_id_key UNIQUE (algo_id);


--
-- Name: alerts pkey_alerts; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT pkey_alerts PRIMARY KEY (id);


--
-- Name: algorithm_catalogue pkey_algo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.algorithm_catalogue
    ADD CONSTRAINT pkey_algo PRIMARY KEY (id);


--
-- Name: area_of_interest pkey_aoi; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.area_of_interest
    ADD CONSTRAINT pkey_aoi PRIMARY KEY (id);


--
-- Name: aoi_algorithm_mapping pkey_aoi_algo_map; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aoi_algorithm_mapping
    ADD CONSTRAINT pkey_aoi_algo_map PRIMARY KEY (id);


--
-- Name: project pkey_project; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT pkey_project PRIMARY KEY (id);


--
-- Name: users pkey_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT pkey_user PRIMARY KEY (user_id);


--
-- Name: users_to_project pkey_users_to_project; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_to_project
    ADD CONSTRAINT pkey_users_to_project PRIMARY KEY (id);


--
-- Name: aoi_algorithm_mapping unique_aoi_algo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aoi_algorithm_mapping
    ADD CONSTRAINT unique_aoi_algo UNIQUE (aoi_id, algo_id);


--
-- Name: area_of_interest unique_aoi_in_project; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.area_of_interest
    ADD CONSTRAINT unique_aoi_in_project UNIQUE (project_id, aoi_id);


--
-- Name: users_to_project unique_user_project; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_to_project
    ADD CONSTRAINT unique_user_project UNIQUE (user_id, project_id);


--
-- Name: alerts fkey_alert_algo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT fkey_alert_algo FOREIGN KEY (algo_fk_id) REFERENCES public.algorithm_catalogue(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: alerts fkey_alert_aoi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT fkey_alert_aoi FOREIGN KEY (aoi_fk_id) REFERENCES public.area_of_interest(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: alerts fkey_alert_project_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT fkey_alert_project_id FOREIGN KEY (project_id) REFERENCES public.project(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: area_of_interest fkey_aoi_project_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.area_of_interest
    ADD CONSTRAINT fkey_aoi_project_id FOREIGN KEY (project_id) REFERENCES public.project(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: aoi_algorithm_mapping fkey_mapping_algo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aoi_algorithm_mapping
    ADD CONSTRAINT fkey_mapping_algo FOREIGN KEY (algo_id) REFERENCES public.algorithm_catalogue(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: aoi_algorithm_mapping fkey_mapping_aoi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aoi_algorithm_mapping
    ADD CONSTRAINT fkey_mapping_aoi FOREIGN KEY (aoi_id) REFERENCES public.area_of_interest(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users_to_project fkey_user_project_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users_to_project
    ADD CONSTRAINT fkey_user_project_id FOREIGN KEY (project_id) REFERENCES public.project(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: debezium_pub1; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION debezium_pub1 WITH (publish = 'insert, update, delete, truncate');


--
-- Name: debezium_pub1 alerts; Type: PUBLICATION TABLE; Schema: public; Owner: -
--

ALTER PUBLICATION debezium_pub1 ADD TABLE ONLY public.alerts;


--
-- PostgreSQL database dump complete
--

\unrestrict dn2tAPjcSRusQmALaagzQXu7Q1fOaQfTw6FMJcGsBfkWQvHtT1mQYHikAzzbfAL

